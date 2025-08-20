// credentials.js - Gerenciamento de credenciais do Mercado Pago

// Elementos do DOM
const statusCard = document.getElementById('statusCard');
const credentialsForm = document.getElementById('credentialsForm');
const accessTokenInput = document.getElementById('accessToken');
const publicKeyInput = document.getElementById('publicKey');
const accessTokenPreview = document.getElementById('accessTokenPreview');
const publicKeyPreview = document.getElementById('publicKeyPreview');
const alertDiv = document.getElementById('alert');
const loadingDiv = document.getElementById('loading');
const saveBtn = document.getElementById('saveBtn');

// Variáveis de estado
let currentCredentials = {
    hasCredentials: false,
    accessTokenPreview: '',
    publicKeyPreview: ''
};

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    // Auto-esconder após 5 segundos
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

// Função para atualizar o card de status
function updateStatusCard(hasCredentials) {
    if (hasCredentials) {
        statusCard.className = 'status-card status-configured';
        statusCard.innerHTML = `
            <div class="status-icon">✅</div>
            <div class="status-info">
                <h3>Credenciais Configuradas</h3>
                <p>Suas credenciais do Mercado Pago estão ativas</p>
            </div>
        `;
    } else {
        statusCard.className = 'status-card status-not-configured';
        statusCard.innerHTML = `
            <div class="status-icon">⚠️</div>
            <div class="status-info">
                <h3>Credenciais Não Configuradas</h3>
                <p>Configure suas credenciais para começar a receber pagamentos</p>
            </div>
        `;
    }
}

// Função para carregar credenciais atuais
async function loadCredentials() {
    try {
        const response = await fetch('/api/credentials', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            currentCredentials = data;
            updateStatusCard(data.hasCredentials);

            // Mostrar previews se existirem credenciais
            if (data.hasCredentials) {
                if (data.accessTokenPreview) {
                    accessTokenPreview.textContent = `Token atual: ****${data.accessTokenPreview}`;
                    accessTokenPreview.style.display = 'block';
                    accessTokenInput.placeholder = 'Digite um novo token para atualizar';
                }

                if (data.publicKeyPreview) {
                    publicKeyPreview.textContent = `Chave atual: ****${data.publicKeyPreview}`;
                    publicKeyPreview.style.display = 'block';
                    publicKeyInput.placeholder = 'Digite uma nova chave para atualizar';
                }
            }
        } else {
            showAlert(data.message || 'Erro ao carregar credenciais', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
        showAlert('Erro ao conectar com o servidor', 'error');
    }
}

// Função para salvar credenciais
async function saveCredentials(e) {
    e.preventDefault();

    const accessToken = accessTokenInput.value.trim();
    const publicKey = publicKeyInput.value.trim();

    // Validações básicas
    if (!accessToken || !publicKey) {
        showAlert('Por favor, preencha todos os campos', 'error');
        return;
    }

    if (accessToken.length < 20) {
        showAlert('Access Token parece inválido (muito curto)', 'error');
        return;
    }

    if (!publicKey.startsWith('APP_USR') && !publicKey.startsWith('TEST')) {
        showAlert('Public Key deve começar com APP_USR ou TEST', 'error');
        return;
    }

    // Mostrar loading
    loadingDiv.style.display = 'block';
    credentialsForm.style.display = 'none';
    saveBtn.disabled = true;

    try {
        const response = await fetch('/api/credentials', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                access_token: accessToken,
                public_key: publicKey
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('✅ Credenciais salvas com sucesso!', 'success');
            
            // Limpar campos
            accessTokenInput.value = '';
            publicKeyInput.value = '';
            
            // Recarregar status
            await loadCredentials();
            
            // Redirecionar após 2 segundos
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 2000);
        } else {
            showAlert(data.message || 'Erro ao salvar credenciais', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar credenciais:', error);
        showAlert('Erro ao conectar com o servidor', 'error');
    } finally {
        loadingDiv.style.display = 'none';
        credentialsForm.style.display = 'block';
        saveBtn.disabled = false;
    }
}

// Função para alternar visibilidade do Access Token
function toggleTokenVisibility() {
    const type = accessTokenInput.type;
    if (type === 'password') {
        accessTokenInput.type = 'text';
        setTimeout(() => {
            accessTokenInput.type = 'password';
        }, 2000);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação (auth.js já deve ter feito isso)
    
    // Carregar credenciais atuais
    loadCredentials();
    
    // Form submit
    credentialsForm.addEventListener('submit', saveCredentials);
    
    // Toggle de visibilidade ao clicar no input de token
    accessTokenInput.addEventListener('dblclick', toggleTokenVisibility);
    
    // Validação em tempo real da Public Key
    publicKeyInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value && !value.startsWith('APP_USR') && !value.startsWith('TEST')) {
            publicKeyInput.style.borderColor = '#dc3545';
        } else {
            publicKeyInput.style.borderColor = '';
        }
    });
    
    // Prevenir colar no campo de token (segurança)
    accessTokenInput.addEventListener('paste', (e) => {
        // Permitir colar, mas avisar sobre segurança
        setTimeout(() => {
            showAlert('⚠️ Certifique-se de estar em um ambiente seguro', 'info');
        }, 100);
    });
});

// Função para formatar preview de credenciais
function formatCredentialPreview(credential, showLastChars = 4) {
    if (!credential) return '';
    if (credential.length <= showLastChars) return credential;
    
    const hidden = '*'.repeat(Math.min(credential.length - showLastChars, 20));
    const visible = credential.slice(-showLastChars);
    return hidden + visible;
}

// Interceptar navegação para confirmar mudanças não salvas
let formChanged = false;

accessTokenInput.addEventListener('input', () => { formChanged = true; });
publicKeyInput.addEventListener('input', () => { formChanged = true; });

window.addEventListener('beforeunload', (e) => {
    if (formChanged && (accessTokenInput.value || publicKeyInput.value)) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja sair?';
    }
});

// Reset flag ao salvar
credentialsForm.addEventListener('submit', () => {
    formChanged = false;
});
