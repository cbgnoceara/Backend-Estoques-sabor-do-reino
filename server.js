// 1. Importar as bibliotecas
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

// ⭐ ADICIONADO PARA DEPURAR AS VARIÁVEIS DE AMBIENTE ⭐


// 2. Configurar o servidor
const app = express();
app.use(cors());
app.use(express.json());

// 3. Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB com sucesso!"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// 4. Definir o "molde" do produto (Schema)
const ProdutoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  quantidade: { type: Number, required: true, default: 0 }
}, {
  collection: 'ProdutosNoEstoque' 
});

const Produto = mongoose.model('Produto', ProdutoSchema);

// 5. Criar as Rotas (API)

// ROTA DE PING PARA MANTER O SERVIDOR ATIVO
app.get('/ping', (req, res) => {
    res.status(200).json({ message: "Ping recebido com sucesso. Servidor está ativo." });
});

// ROTA PARA BUSCAR TODOS OS PRODUTOS (GET)
app.get('/produtos', async (req, res) => {
  try {
    const produtos = await Produto.find().sort({ nome: 1 });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar produtos." });
  }
});

// ROTA PARA ADICIONAR UM NOVO PRODUTO (POST)
app.post('/produtos', async (req, res) => {
  try {
    const novoProduto = new Produto({
      nome: req.body.nome,
      quantidade: req.body.quantidade
    });
    await novoProduto.save();
    res.status(201).json(novoProduto);
  } catch (error) {
    res.status(500).json({ message: "Erro ao criar produto." });
  }
});

// ROTA PARA ATUALIZAR A QUANTIDADE (+1 ou -1) (PATCH)
app.patch('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { incremento } = req.body;
    const produtoAtualizado = await Produto.findByIdAndUpdate(
      id,
      { $inc: { quantidade: incremento } },
      { new: true }
    );
    res.json(produtoAtualizado);
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar produto." });
  }
});

// ROTA PARA EDITAR UM PRODUTO (NOME E QUANTIDADE) (PUT)
app.put('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, quantidade } = req.body;
        const produtoEditado = await Produto.findByIdAndUpdate(
            id,
            { nome, quantidade },
            { new: true }
        );
        res.json(produtoEditado);
    } catch (error) {
        res.status(500).json({ message: "Erro ao editar produto." });
    }
});

// ROTA PARA EXCLUIR UM PRODUTO (DELETE)
app.delete('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Produto.findByIdAndDelete(id);
        res.json({ message: "Produto excluído com sucesso." });
    } catch (error) {
        res.status(500).json({ message: "Erro ao excluir produto." });
    }
});


// 6. Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  // LÓGICA DE AUTO-PING A CADA 5 MINUTOS
  const SELF_URL = process.env.SELF_URL;
  if (SELF_URL) {
    setInterval(() => {
      axios.get(`${SELF_URL}/ping`)
        .then(() => {
          console.log(`[AUTO-PING] Ping enviado para ${SELF_URL}/ping`);
        })
        .catch((err) => {
          console.error(`[AUTO-PING] Erro ao enviar ping: ${err.message}`);
        });
    }, 5 * 60 * 1000); // 5 minutos
  } else {
    console.warn("[AUTO-PING] A variável SELF_URL não foi encontrada no ambiente. O auto-ping está desativado.");
  }
});

