const express = require('express');
const crypto = require('crypto');  // Usado para gerar um token aleatório
const router = express.Router();
const { connect } = require('../../config/database');
const nodemailer = require('nodemailer');

// Tempo de expiração do token: 1 hora
const tokenExpiryTime = 3600;  // Em segundos (3600 = 1 hora)

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const pool = await connect();

        // Verificar se o usuário existe
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const user = users[0];

        // Gerar um token de 8 caracteres
        const resetToken = crypto.randomBytes(4).toString('hex');  // Gera um token aleatório de 8 caracteres (4 bytes)

        // Definir o tempo de expiração para o token
        const expiryDate = new Date(Date.now() + tokenExpiryTime * 1000);  // Tempo atual + 1 hora

        // Armazenar o token e a data de expiração no banco de dados
        await pool.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [resetToken, expiryDate, user.id]);

        const transporter = nodemailer.createTransport({
            host: 'smtp.hostinger.com',
            port: 465,
            secure: true,
            auth: {
                user: 'contato@conexaocode.com',
                pass: '#Henrique1312'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const resetLink = `http://localhost:1234/esqueci-senha/${resetToken}`;

        await transporter.sendMail({
            from: 'contato@conexaocode.com',
            to: email,
            subject: 'Recuperação de Senha',
            text: `Clique no link para redefinir sua senha: ${resetLink}`,
            html: `
                <div style="width: 100%; font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box;">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                        <tr>
                            <td align="center" style="padding: 20px 0;">
                                <img src="https://conexaocode.com/logo.png" alt="Logo" style="width: 120px; height: auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 20px;">
                                <h1 style="color: #333333; font-size: 24px; margin: 0;">Redefinição de senha</h1>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 10px 30px;">
                                <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                                    Uma solicitação de alteração de senha foi feita para sua conta. Se foi você, utilize o link abaixo para redefinir sua senha.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 20px;">
                                <a href="${resetLink}" style="background-color: #28a745; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px; display: inline-block;">
                                    Redefinir senha
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 20px;">
                                <p style="color: #999999; font-size: 12px;">
                                    Se você não solicitou isso, por favor, ignore este e-mail.
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>
            `
        }, (error, info) => {
            if (error) {
                console.error('Erro ao enviar o e-mail:', error);
            } 
        });

        res.json({ message: 'Link de recuperação enviado para o e-mail.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;
