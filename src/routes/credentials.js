const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/database');
const authMiddleware = require('../middleware/auth');

// Chave para criptografia (em produção, usar variável de ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!!';
const IV_LENGTH = 16;

// Funções de criptografia
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
        iv
    );
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
            iv
        );
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString();
    } catch (error) {
        console.error('Erro ao descriptografar:', error);
        return null;
    }
}

// GET /api/credentials - Buscar status das credenciais
router.get('/', authMiddleware, (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Buscar usuário no banco
        const stmt = db.prepare('SELECT access_token, public_key FROM users WHERE id = ?');
        const user = stmt.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }
        
        // Verificar se tem credenciais configuradas
        const hasCredentials = !!(user.access_token && user.public_key);
        
        // Preparar preview das credenciais
        let publicKeyPreview = '';
        let accessTokenPreview = '';
        
        if (user.public_key) {
            // Mostrar apenas os últimos 4 caracteres da public key
            const publicKey = user.public_key;
            publicKeyPreview = publicKey.length > 4 
                ? '...' + publicKey.slice(-4) 
                : publicKey;
        }
        
        if (user.access_token) {
            // Descriptografar para verificar se existe, mas não retornar
            const decrypted = decrypt(user.access_token);
            if (decrypted && decrypted.length > 4) {
                accessTokenPreview = '...' + decrypted.slice(-4);
            }
        }
        
        res.json({
            success: true,
            hasCredentials,
            publicKeyPreview,
            accessTokenPreview,
            message: hasCredentials 
                ? 'Credenciais configuradas' 
                : 'Credenciais não configuradas'
        });
        
    } catch (error) {
        console.error('Erro ao buscar credenciais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar credenciais'
        });
    }
});

// PUT /api/credentials - Atualizar credenciais
router.put('/', authMiddleware, (req, res) => {
    try {
        const userId = req.session.userId;
        const { access_token, public_key } = req.body;
        
        // Validar entrada
        if (!access_token || !public_key) {
            return res.status(400).json({
                success: false,
                message: 'Access Token e Public Key são obrigatórios'
            });
        }
        
        // Validar formato básico
        if (access_token.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Access Token inválido'
            });
        }
        
        if (!public_key.startsWith('APP_USR') && !public_key.startsWith('TEST')) {
            return res.status(400).json({
                success: false,
                message: 'Public Key deve começar com APP_USR ou TEST'
            });
        }
        
        // Criptografar access token
        const encryptedToken = encrypt(access_token);
        
        // Atualizar no banco
        const stmt = db.prepare(`
            UPDATE users 
            SET access_token = ?, public_key = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(encryptedToken, public_key, userId);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Credenciais atualizadas com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao atualizar credenciais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar credenciais'
        });
    }
});

// DELETE /api/credentials - Remover credenciais (opcional)
router.delete('/', authMiddleware, (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Limpar credenciais
        const stmt = db.prepare(`
            UPDATE users 
            SET access_token = NULL, public_key = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(userId);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Credenciais removidas com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao remover credenciais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover credenciais'
        });
    }
});

module.exports = router;
