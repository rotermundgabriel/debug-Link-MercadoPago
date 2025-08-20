// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const {
    hashPassword,
    verifyPassword,
    generateToken,
    validateEmail,
    validatePassword
} = require('../services/auth');

// Inicializa conexão com o banco
const db = new Database(path.join(process.cwd(), 'database.db'));

// Primeiro, vamos alterar a tabela users para incluir os campos necessários
// Este código roda apenas uma vez para adicionar as colunas se não existirem
try {
    // Verifica se as colunas já existem
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes('email')) {
        db.prepare('ALTER TABLE users ADD COLUMN email TEXT UNIQUE').run();
    }
    if (!columns.includes('password')) {
        db.prepare('ALTER TABLE users ADD COLUMN password TEXT').run();
    }
    if (!columns.includes('name')) {
        db.prepare('ALTER TABLE users ADD COLUMN name TEXT').run();
    }
    
    console.log('Tabela users atualizada com sucesso');
} catch (error) {
    console.log('Colunas já existem ou erro ao atualizar tabela:', error.message);
}

/**
 * POST /api/auth/register
 * Registra um novo usuário
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Log para debug
        console.log('Tentativa de registro:', { email, name });

        // Validação dos campos obrigatórios
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, senha e nome são obrigatórios'
            });
        }

        // Valida formato do email
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Email inválido'
            });
        }

        // Valida senha
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                error: passwordValidation.message
            });
        }

        // Verifica se o email já está cadastrado
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        
        if (existingUser) {
            console.log('Email já cadastrado:', email);
            return res.status(409).json({
                success: false,
                error: 'Email já cadastrado'
            });
        }

        // Gera hash da senha
        const hashedPassword = await hashPassword(password);

        // Cria o novo usuário
        const userId = uuidv4();
        const stmt = db.prepare(`
            INSERT INTO users (id, email, password, name, store_name, access_token, public_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        stmt.run(
            userId,
            email.toLowerCase(),
            hashedPassword,
            name,
            name + "'s Store", // Nome padrão da loja
            '', // Access token será configurado depois
            ''  // Public key será configurada depois
        );

        // Gera token JWT
        const token = generateToken({
            userId,
            email: email.toLowerCase(),
            name
        });

        console.log('Usuário registrado com sucesso:', userId);

        // Retorna sucesso
        res.status(201).json({
            success: true,
            token,
            user: {
                id: userId,
                email: email.toLowerCase(),
                name
            }
        });

    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production' 
                ? 'Erro ao registrar usuário' 
                : error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Autentica um usuário existente
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Log para debug
        console.log('Tentativa de login:', { email });

        // Validação dos campos obrigatórios
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e senha são obrigatórios'
            });
        }

        // Busca o usuário pelo email
        const user = db.prepare(`
            SELECT id, email, password, name 
            FROM users 
            WHERE email = ?
        `).get(email.toLowerCase());

        if (!user) {
            console.log('Usuário não encontrado:', email);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        // Verifica a senha
        const passwordMatch = await verifyPassword(password, user.password);

        if (!passwordMatch) {
            console.log('Senha incorreta para:', email);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        // Gera token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            name: user.name
        });

        console.log('Login bem-sucedido:', user.id);

        // Retorna sucesso
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production' 
                ? 'Erro ao fazer login' 
                : error.message
        });
    }
});

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado (opcional, útil para verificar token)
 */
router.get('/me', (req, res) => {
    // Este endpoint requer o middleware de autenticação
    // Será útil quando o middleware estiver aplicado
    res.json({
        success: false,
        error: 'Endpoint requer autenticação'
    });
});

module.exports = router;
