const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');
const nodemailer = require('nodemailer');

router.get('/users-list', async (req, res) => {
    const { company_id } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'company_id é obrigatório' });
    }

    try {
        const pool = await connect();
        const [users] = await pool.query(
            `SELECT id, full_name AS name, role, company_id 
             FROM users
             WHERE company_id = ?`,
            [company_id]
        );

        const mappedUsers = users.map(user => ({
            ...user,
            role: user.role === 'ceo' ? 'Administrador' : user.role === 'mod' ? 'Moderador' : 'Recepcionista'
        }));

        res.json(mappedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar usuários' });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { company_id } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'O company_id é obrigatório.' });
    }

    try {
        const pool = await connect();

        const [user] = await pool.query(
            'SELECT * FROM users WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        if (user.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado ou não pertence à empresa especificada.' });
        }

        await pool.query('DELETE FROM users WHERE id = ? AND company_id = ?', [id, company_id]);

        res.json({ message: 'Usuário deletado com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar usuário.' });
    }
});

const generatePassword = () => {
    return Math.random().toString(36).slice(-8); // Gera uma senha de 8 caracteres
};

// Configuração do transporte de e-mail (usando o nodemailer)
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

const generateWelcomeEmailContent = (companyName, email, password) => {
    return `
        <div style="width: 100%; font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <img src="https://cdn.discordapp.com/attachments/1232894603498229773/1301056924485156926/logob.png" alt="Logo" style="width: 120px; height: auto;" />
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <h1 style="color: #333333; font-size: 24px; margin: 0;">Bem-vindo(a) à ${companyName}</h1>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 10px 30px;">
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                            Sua conta foi criada com sucesso! Abaixo estão suas credenciais de acesso.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                            <strong>E-mail:</strong> ${email}<br />
                            <strong>Senha:</strong> ${password}
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                            Recomendamos que você altere sua senha após o primeiro login.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <a href="http://localhost:1234/login" 
                            style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #ffffff; background-color: #e1ff01; border-radius: 5px; text-decoration: none; font-weight: bold;">
                            Acessar Plataforma
                        </a>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <p style="color: #999999; font-size: 12px;">
                            Obrigado por se juntar à nossa equipe!
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

router.post('/users', async (req, res) => {
    const { name, email, role, company_id } = req.body;


    if (!name || !email || !role || !company_id) {
        console.warn("Campos obrigatórios ausentes.");
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    const roleMapping = {
        'Administrador': 'ceo',
        'Moderador': 'mod',
        'Recepcionista': 'rec'
    };

    const dbRole = roleMapping[role];
    if (!dbRole) {
        console.warn("Cargo inválido:", role);
        return res.status(400).json({ message: 'Cargo inválido' });
    }

    const password = generatePassword();

    try {
        const pool = await connect();

        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            console.warn("E-mail já cadastrado:", email);
            return res.status(409).json({ message: 'E-mail já cadastrado' });
        }

        await pool.query(
            'INSERT INTO users (full_name, email, password, role, company_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [name, email, password, dbRole, company_id]
        );

        // Configuração do e-mail
        const mailOptions = {
            from: 'contato@conexaocode.com',
            to: email,
            subject: 'Bem-vindo(a) à nossa equipe!',
            html: generateWelcomeEmailContent(company_id, email, password),
        };


        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Erro ao enviar e-mail:", error); // Log de erro no envio de e-mail
                return res.status(500).json({ message: 'Erro ao enviar o e-mail' });
            }
            res.status(201).json({ message: 'Usuário criado com sucesso e e-mail enviado!' });
        });
    } catch (error) {
        console.error("Erro ao criar usuário:", error); // Log de erro geral
        res.status(500).json({ message: 'Erro ao criar usuário' });
    }
});




module.exports = router;
