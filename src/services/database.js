const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados (na raiz do projeto)
const DB_PATH = path.join(__dirname, '..', '..', 'database.db');

let db;
let isReady = false;

try {
  // Inicializar conexão com SQLite
  console.log('📂 Inicializando banco de dados...');
  console.log(`📍 Caminho do banco: ${DB_PATH}`);
  
  db = new Database(DB_PATH);
  
  // Configurações para melhor performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 1000');
  db.pragma('foreign_keys = ON');
  
  // Executar schema SQL para criar tabelas
  initializeSchema();
  
  isReady = true;
  console.log('✅ Banco de dados inicializado com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao inicializar banco de dados:', error);
  isReady = false;
}

function initializeSchema() {
  console.log('📋 Criando tabelas do banco...');
  
  // Schema SQL do banco
  const schema = `
    -- Tabela de usuários (vendedores)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      public_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de links de pagamento
    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
      payment_id TEXT,
      payer_email TEXT,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Índices para melhorar performance
    CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
    CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
    CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at);

    -- Tabela de webhooks/notificações (opcional mas útil)
    CREATE TABLE IF NOT EXISTS payment_notifications (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      mp_notification_id TEXT,
      status TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (link_id) REFERENCES payment_links(id)
    );
  `;
  
  try {
    // Executar cada comando SQL separadamente
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement.trim() + ';');
      }
    }
    
    console.log('✅ Tabelas criadas com sucesso!');
    
    // Verificar se as tabelas foram criadas
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('📊 Tabelas disponíveis:', tables.map(t => t.name).join(', '));
    
  } catch (error) {
    console.error('❌ Erro ao criar schema:', error);
    throw error;
  }
}

// Função para executar script de inicialização manual
function initDatabase() {
  if (!isReady) {
    throw new Error('Banco de dados não está pronto');
  }
  
  console.log('🔄 Reinicializando schema do banco...');
  initializeSchema();
  console.log('✅ Banco reinicializado!');
}

// Função para fechar conexão (útil em testes)
function closeDatabase() {
  if (db) {
    db.close();
    console.log('🔒 Conexão com banco fechada');
  }
}

// Função para obter estatísticas do banco
function getStats() {
  if (!isReady) return null;
  
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const linkCount = db.prepare('SELECT COUNT(*) as count FROM payment_links').get().count;
    const paidCount = db.prepare("SELECT COUNT(*) as count FROM payment_links WHERE status = 'paid'").get().count;
    
    return {
      users: userCount,
      links: linkCount,
      paid_links: paidCount
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return null;
  }
}

// Exportar instância do banco e funções utilitárias
module.exports = {
  db,
  isReady,
  initDatabase,
  closeDatabase,
  getStats
};

// Se executado diretamente (npm run init-db)
if (require.main === module) {
  initDatabase();
}
