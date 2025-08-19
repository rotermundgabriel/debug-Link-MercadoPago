const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar serviços
const database = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware de log para debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Servidor rodando",
    timestamp: new Date().toISOString()
  });
});

// Rota para servir o index.html na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro na aplicação:', error);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Algo deu errado'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log('🚀 Servidor MP Payment Links iniciado!');
  console.log(`📍 Rodando em: http://localhost:${PORT}`);
  console.log(`🗄️ Banco de dados: ${database.isReady ? 'Conectado' : 'Erro na conexão'}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('📝 Acesse /api/health para testar a API');
});

module.exports = app;
