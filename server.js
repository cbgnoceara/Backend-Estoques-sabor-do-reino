// 1. Importar as bibliotecas
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

// 2. Configurar o servidor
const app = express();
app.use(cors());
app.use(express.json());

// 3. Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB com sucesso!"))
  .catch((err) => console.error("Erro ao conectar ao MongoDB:", err));

// 4. ⭐ NOVO "MOLDE" DO PRODUTO (SCHEMA) - Agora mais inteligente!
const VariacaoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  pesoKg: { type: Number, required: true }
});

const ProdutoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  quantidade: { type: Number, required: true, default: 0 },
  unidadeDeMedida: {
    type: String,
    required: true,
    enum: ['UN', 'KG'] // Só aceita 'UN' ou 'KG'
  },
  variacoes: [VariacaoSchema] // Um array de variações, opcional
}, {
  collection: 'ProdutosNoEstoque' 
});

const Produto = mongoose.model('Produto', ProdutoSchema);

// 5. ROTAS DA API (ATUALIZADAS PARA A NOVA LÓGICA)

app.get('/ping', (req, res) => {
    res.status(200).json({ message: "Ping recebido com sucesso. Servidor está ativo." });
});

// GET /produtos - Não precisa de alteração
app.get('/produtos', async (req, res) => {
  try {
    const produtos = await Produto.find().sort({ nome: 1 });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar produtos." });
  }
});

// POST /produtos - Atualizado para receber os novos campos
app.post('/produtos', async (req, res) => {
  try {
    const { nome, quantidade, unidadeDeMedida, variacoes } = req.body;
    const novoProduto = new Produto({ nome, quantidade, unidadeDeMedida, variacoes });
    await novoProduto.save();
    res.status(201).json(novoProduto);
  } catch (error) {
    res.status(500).json({ message: "Erro ao criar produto." });
  }
});

// ⭐ PATCH /produtos/:id - Rota de atualização de estoque totalmente refeita
app.patch('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, valor } = req.body;
    let atualizacao;

    switch (tipo) {
      case 'UN': // Venda por unidade
        atualizacao = { $inc: { quantidade: valor } }; // valor será -1 ou +1
        break;
      case 'KG': // Venda a granel
        atualizacao = { $inc: { quantidade: valor } }; // valor será o peso, ex: -0.250
        break;
      case 'VARIACAO': // Venda de uma variação (ex: pote de açaí)
        const produto = await Produto.findById(id);
        if (!produto) return res.status(404).json({ message: "Produto não encontrado." });
        
        const variacao = produto.variacoes.find(v => v.nome === valor.nome);
        if (!variacao) return res.status(404).json({ message: "Variação não encontrada." });

        const pesoTotalVendido = variacao.pesoKg * valor.quantidade;
        atualizacao = { $inc: { quantidade: -pesoTotalVendido } };
        break;
      default:
        return res.status(400).json({ message: "Tipo de atualização inválido." });
    }

    const produtoAtualizado = await Produto.findByIdAndUpdate(id, atualizacao, { new: true });
    res.json(produtoAtualizado);

  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar produto." });
  }
});

// PUT /produtos/:id - Atualizado para editar todos os campos
app.put('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, quantidade, unidadeDeMedida, variacoes } = req.body;
        const produtoEditado = await Produto.findByIdAndUpdate(
            id,
            { nome, quantidade, unidadeDeMedida, variacoes },
            { new: true }
        );
        res.json(produtoEditado);
    } catch (error) {
        res.status(500).json({ message: "Erro ao editar produto." });
    }
});

// DELETE /produtos/:id - Não precisa de alteração
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

  // Lógica de auto-ping (sem alterações)
  const SELF_URL = process.env.SELF_URL;
  if (SELF_URL) {
    setInterval(() => {
      axios.get(`${SELF_URL}/ping`)
        .then(() => console.log(`[AUTO-PING] Ping enviado para ${SELF_URL}/ping`))
        .catch((err) => console.error(`[AUTO-PING] Erro ao enviar ping: ${err.message}`));
    }, 5 * 60 * 1000);
  } else {
    console.warn("[AUTO-PING] A variável SELF_URL não está definida. O auto-ping está desativado.");
  }
});
