const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { connect } = require('../../config/database');

function generateToken() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
        token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
}

router.post('/register-promoter', async (req, res) => {
    const { full_name, email, cpf, telefone, password, fantasy_name } = req.body;

    try {
        const pool = await connect();

        const [company] = await pool.query('SELECT id FROM companies WHERE fantasy_name = ?', [fantasy_name]);
        if (company.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }
        const company_id = company[0].id;

        const [emailExists] = await pool.query(
            'SELECT * FROM promoters WHERE email = ? AND company_id = ?', [email, company_id]
        );
        if (emailExists.length > 0) {
            return res.status(400).json({ message: 'Email já está em uso' });
        }

        const [cpfExists] = await pool.query(
            'SELECT * FROM promoters WHERE cpf = ? AND company_id = ?', [cpf, company_id]
        );
        if (cpfExists.length > 0) {
            return res.status(400).json({ message: 'CPF já está em uso' });
        }

        const [telefoneExists] = await pool.query(
            'SELECT * FROM promoters WHERE telefone = ? AND company_id = ?', [telefone, company_id]
        );
        if (telefoneExists.length > 0) {
            return res.status(400).json({ message: 'Telefone já está em uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = generateToken(); // Gerando o token de 6 caracteres

        await pool.query(
            'INSERT INTO promoters (full_name, email, cpf, telefone, password, company_id, token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [full_name, email, cpf, telefone, hashedPassword, company_id, token]
        );

        res.status(201).json({ message: 'Promoter registrado com sucesso', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;
