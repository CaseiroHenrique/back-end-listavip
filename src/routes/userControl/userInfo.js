const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.get('/user-infos', async (req, res) => {
    const { full_name } = req.query;

    try {
        const pool = await connect();

        const [users] = await pool.query('SELECT * FROM users WHERE full_name = ?', [full_name]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const dbUser = users[0];

        const [company] = await pool.query('SELECT domain, logo_url, background_url, background_color, blur_effect FROM companies WHERE id = ?', [dbUser.company_id]);

        if (company.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }

        const companyData = company[0];

        res.json({
            id: dbUser.id,
            full_name: dbUser.full_name,
            email: dbUser.email,
            phone: dbUser.phone,
            gender: dbUser.gender,
            birth_date: dbUser.birth_date,
            cpf: dbUser.cpf,
            rg: dbUser.rg,
            pix_key: dbUser.pix_key,
            company_id: dbUser.company_id,
            role: dbUser.role,
            session_token: dbUser.session_token,
            session_expiry: dbUser.session_expiry,
            company: {
                domain: companyData.domain,
                logo_url: companyData.logo_url,
                background_url: companyData.background_url,
                background_color: companyData.background_color,
                blur_effect: companyData.blur_effect
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/update-user-info', async (req, res) => {
    const { full_name, email, phone, birth_date, cpf, rg, pix_key, domain, logo_url, background_url, background_color, blur_effect, company_id } = req.body;

    try {
        const pool = await connect();

        // Verifica o usuário pelo full_name
        const [userResult] = await pool.query('SELECT id, company_id FROM users WHERE company_id = ?', [company_id]);

        if (userResult.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const userId = userResult[0].id;
        const companyId = userResult[0].company_id;

        // Atualiza os dados do usuário
        const userUpdateQuery = `
            UPDATE users 
            SET full_name = ?, email = ?, telefone = ?, data_nascimento = ?, cpf = ?, rg = ?, chave_pix = ?
            WHERE id = ?
        `;
        await pool.query(userUpdateQuery, [full_name, email, phone, birth_date, cpf, rg, pix_key, userId]);

        // Atualiza os dados da empresa
        const companyUpdateQuery = `
            UPDATE companies 
            SET domain = ?, logo_url = ?, background_url = ?, background_color = ?, blur_effect = ?
            WHERE id = ?
        `;
        await pool.query(companyUpdateQuery, [domain, logo_url, background_url, background_color, blur_effect, companyId]);

        res.status(200).json({ message: 'Informações atualizadas com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar informações' });
    }
});




module.exports = router;
