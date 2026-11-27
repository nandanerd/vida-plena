
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

// =====================================
// BANCO DE DADOS
// =====================================

function bancoVazio() {
    return {
        usuarios: [],
        pacientes: [],
        triagens: [],
        consultas: [],
        estoque: [],
        historicoEntradas: []
    };
}
 
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const db = bancoVazio();
        writeDB(db);
        return db;
    }

    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        const inicial = bancoVazio();

        Object.keys(inicial).forEach(chave => {
            if (!Array.isArray(db[chave])) {
                db[chave] = inicial[chave];
            }
        });

        return db;
    } catch (erro) {
        console.error("Erro ao ler banco:", erro);
        throw new Error("Banco de dados inválido.");
    }
}

function writeDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalizar(texto) {
    return String(texto || "").trim().toLowerCase();
}

// =====================================
// USUÁRIOS
// =====================================

app.post("/usuarios", (req, res) => {
    try {
        const db = readDB();

        const usuario = String(req.body.usuario || "").trim();
        const senha = String(req.body.senha || "");
        const tipo = req.body.tipo;

        if (!usuario || !senha || !tipo) {
            return res.status(400).json({
                erro: "Preencha todos os campos."
            });
        }

  const setores = ["atendimento", "triagem", "medico", "admin", "medicacoes"];

        if (!setores.includes(tipo)) {
            return res.status(400).json({
                erro: "Setor inválido."
            });
        }

        if (db.usuarios.some(u =>
            normalizar(u.usuario) === normalizar(usuario)
        )) {
            return res.status(409).json({
                erro: "Usuário já cadastrado."
            });
        }

        const novoUsuario = {
            id: Date.now(),
            usuario,
            senha,
            tipo
        };

        db.usuarios.push(novoUsuario);
        writeDB(db);

        res.status(201).json({
            sucesso: true,
            usuario: {
                id: novoUsuario.id,
                usuario,
                tipo
            }
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.get("/usuarios", (req, res) => {
    const db = readDB();

    res.json(db.usuarios.map(u => ({
        id: u.id,
        usuario: u.usuario,
        tipo: u.tipo
    })));
});

// =====================================
// LOGIN
// =====================================

app.post("/login", (req, res) => {
    try {
        const db = readDB();

        const usuario = String(req.body.usuario || "").trim();
        const senha = String(req.body.senha || "");

        const user = db.usuarios.find(u =>
            normalizar(u.usuario) === normalizar(usuario) &&
            String(u.senha) === senha
        );

        if (!user) {
            return res.status(401).json({
                erro: "Usuário ou senha inválidos."
            });
        }

        res.json({
            sucesso: true,
            usuario: user.usuario,
            tipo: user.tipo
        });

    } catch (erro) {
        res.status(500).json({ erro: "Erro no login." });
    }
});

// =====================================
// ATENDIMENTO
// =====================================

app.post("/atendimento", (req, res) => {
    try {
        const db = readDB();

        const nome = String(req.body.nome || "").trim();
        const cpf = String(req.body.cpf || "").trim();

        if (!nome || !cpf) {
            return res.status(400).json({
                erro: "Nome e CPF são obrigatórios."
            });
        }

        const paciente = {
            id: Date.now(),
            nome,
            cpf,
            tipo: req.body.tipo,
            status: "triagem",
            createdAt: new Date().toISOString()
        };

        db.pacientes.push(paciente);
        writeDB(db);

        res.status(201).json({
            sucesso: true,
            paciente
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// =====================================
// TRIAGEM
// =====================================

app.post("/triagem", (req, res) => {
    try {
        const db = readDB();

        const temperatura = Number(req.body.temperatura);
        let risco = req.body.risco;

        if (temperatura >= 39) {
            risco = "vermelho";
        } else if (temperatura >= 38) {
            risco = "amarelo";
        }

        const triagem = {
            id: Date.now(),
            nome: req.body.nome,
            sintoma: req.body.sintoma,
            temperatura,
            alergia: req.body.alergia,
            observacao: req.body.observacao,
            risco: risco || "verde",
            status: "aguardando_medico",
            createdAt: new Date().toISOString()
        };

        db.triagens.push(triagem);
        writeDB(db);

        res.status(201).json({
            sucesso: true,
            triagem
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// =====================================
// PACIENTES PARA O MÉDICO
// =====================================

app.get("/pacientes-medico", (req, res) => {
    try {
        const db = readDB();

        const pacientes = db.triagens
            .filter(t => t.status === "aguardando_medico")
            .map(t => {
                const paciente = db.pacientes.find(p =>
                    normalizar(p.nome) === normalizar(t.nome)
                );

                return {
                    id: t.id,
                    nome: t.nome,
                    cpf: paciente?.cpf || "Não informado",
                    tipo: paciente?.tipo || "Não informado",
                    sintomas: t.sintoma || "Não informado",
                    temperatura: t.temperatura,
                    risco: t.risco || "Não classificado",
                    alergia: t.alergia || "Nenhuma",
                    observacao: t.observacao || "Nenhuma"
                };
            });

        res.json(pacientes);

    } catch (erro) {
        res.status(500).json({
            erro: "Erro ao carregar pacientes."
        });
    }
});

// =====================================
// ALMOXARIFADO - LISTAR ESTOQUE
// =====================================

app.get("/estoque", (req, res) => {
    const db = readDB();
    res.json(db.estoque);
});

// =====================================
// ALMOXARIFADO - CADASTRAR MEDICAMENTO
// =====================================

app.post("/estoque", (req, res) => {
    try {
        const db = readDB();

        const nome = String(req.body.nome || "").trim();
        const quantidade = Number(req.body.quantidade);

        if (!nome || !Number.isInteger(quantidade) || quantidade <= 0) {
            return res.status(400).json({
                erro: "Informe nome e quantidade válida."
            });
        }

        const existe = db.estoque.find(m =>
            normalizar(m.nome) === normalizar(nome)
        );

        if (existe) {
            return res.status(409).json({
                erro: "Medicamento já cadastrado. Utilize a opção de reposição."
            });
        }

        const medicamento = {
            id: Date.now(),
            nome,
            quantidade,
            unidade: req.body.unidade || "unidades",
            categoria: req.body.categoria || "Geral",
            createdAt: new Date().toISOString()
        };

        db.estoque.push(medicamento);

        db.historicoEntradas.unshift({
            id: Date.now(),
            medicamentoId: medicamento.id,
            nome,
            quantidade,
            tipo: "entrada",
            data: new Date().toISOString()
        });

        writeDB(db);

        res.status(201).json({
            sucesso: true,
            mensagem: "Medicamento cadastrado!",
            medicamento
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// =====================================
// ALMOXARIFADO - REPOR OU AJUSTAR ESTOQUE
// PATCH RECEBE UMA QUANTIDADE DE ALTERAÇÃO
// Exemplo: 10 adiciona 10; -2 remove 2.
// =====================================

app.patch("/estoque/:id", (req, res) => {
    try {
        const db = readDB();

        const medicamento = db.estoque.find(m =>
            String(m.id) === String(req.params.id)
        );

        if (!medicamento) {
            return res.status(404).json({
                erro: "Medicamento não encontrado."
            });
        }

        const alteracao = Number(req.body.quantidade);

        if (!Number.isInteger(alteracao) || alteracao === 0) {
            return res.status(400).json({
                erro: "Informe uma quantidade inteira diferente de zero."
            });
        }

        const novoTotal = medicamento.quantidade + alteracao;

        if (novoTotal < 0) {
            return res.status(400).json({
                erro: "Não é possível deixar o estoque negativo."
            });
        }

        medicamento.quantidade = novoTotal;

        if (alteracao > 0) {
            db.historicoEntradas.unshift({
                id: Date.now(),
                medicamentoId: medicamento.id,
                nome: medicamento.nome,
                quantidade: alteracao,
                tipo: "reposição",
                data: new Date().toISOString()
            });
        }

        writeDB(db);

        res.json({
            sucesso: true,
            medicamento
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// =====================================
// ALMOXARIFADO - HISTÓRICO
// =====================================

app.get("/historico-estoque", (req, res) => {
    const db = readDB();
    res.json(db.historicoEntradas);
});

// =====================================
// ALMOXARIFADO - REMOVER MEDICAMENTO
// =====================================

app.delete("/estoque/:id", (req, res) => {
    try {
        const db = readDB();

        const index = db.estoque.findIndex(m =>
            String(m.id) === String(req.params.id)
        );

        if (index === -1) {
            return res.status(404).json({
                erro: "Medicamento não encontrado."
            });
        }

        const removido = db.estoque[index];

        db.estoque.splice(index, 1);
        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Medicamento removido.",
            medicamento: removido
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

// =====================================
// LISTA DE MEDICAMENTOS DISPONÍVEIS
// =====================================

app.get("/lista-medicacoes", (req, res) => {
    const db = readDB();

    res.json(
        db.estoque.map(m => ({
            id: m.id,
            nome: m.nome,
            quantidade: m.quantidade,
            unidade: m.unidade
        }))
    );
});

// =====================================
// CONSULTA MÉDICA
// DESCONTA AUTOMATICAMENTE 1 UNIDADE
// =====================================

app.post("/consulta", (req, res) => {
    try {
        const db = readDB();

        const pacienteNome = String(req.body.paciente || "").trim();
        const diagnostico = String(req.body.diagnostico || "").trim();
        const medicacaoId = req.body.medicacaoId;
        const medicacaoNome = String(req.body.medicacao || "").trim();

        if (!pacienteNome || !diagnostico || (!medicacaoId && !medicacaoNome)) {
            return res.status(400).json({
                erro: "Preencha paciente, diagnóstico e medicação."
            });
        }

        // Localiza o medicamento pelo ID ou nome.
        const medicamento = db.estoque.find(m => {
            if (medicacaoId !== undefined && medicacaoId !== null && medicacaoId !== "") {
                return String(m.id) === String(medicacaoId);
            }

            return normalizar(m.nome) === normalizar(medicacaoNome);
        });

        if (!medicamento) {
            return res.status(404).json({
                erro: "Medicamento não encontrado no almoxarifado."
            });
        }

        if (medicamento.quantidade < 1) {
            return res.status(409).json({
                erro: "Medicamento sem estoque disponível."
            });
        }

        // Desconto automático de uma unidade.
        medicamento.quantidade -= 1;

        const consulta = {
            id: Date.now(),
            paciente: pacienteNome,
            diagnostico,
            medicacao: medicamento.nome,
            medicacaoId: medicamento.id,
            quantidadeRetirada: 1,
            unidade: medicamento.unidade,
            obs: req.body.obs || "",
            createdAt: new Date().toISOString()
        };

        db.consultas.push(consulta);

        // Marca a triagem como atendida.
        const triagem = db.triagens.find(t =>
            normalizar(t.nome) === normalizar(pacienteNome) &&
            t.status === "aguardando_medico"
        );

        if (triagem) {
            triagem.status = "atendido";
            triagem.atendidoEm = new Date().toISOString();
        }

        writeDB(db);

        res.status(201).json({
            sucesso: true,
            mensagem: "Consulta salva e estoque atualizado!",
            consulta,
            estoqueAtual: medicamento.quantidade
        });

    } catch (erro) {
        console.error("Erro na consulta:", erro);

        res.status(500).json({
            erro: "Não foi possível salvar a consulta."
        });
    }
});

// =====================================
// LISTAR CONSULTAS / PRESCRIÇÕES
// =====================================

app.get("/medicacoes", (req, res) => {
    const db = readDB();
    res.json(db.consultas);
});

// =====================================
// PAINEL TV
// =====================================

app.get("/tv/chamada", (req, res) => {
    const db = readDB();

    res.json({
        chamada: db.chamadaAtual || null,
        historico: db.historicoChamadas || []
    });
});

// =====================================
// ROTA PRINCIPAL
// =====================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../frontend/index.html")
    );
});


 // ===============================
 // SERVIDOR
 // ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("");
    console.log("==============================================");
    console.log("       HOSPITAL VIDA PLENA - SISTEMA");
    console.log("==============================================");
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log("==============================================");
});
