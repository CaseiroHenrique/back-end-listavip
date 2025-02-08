const express = require('express');
const router = express.Router();
const { connect } = require('../config/database');

function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, "");
}

router.post('/reserve', async (req, res) => {
    let { phone, cpf, email, name, ...otherData } = req.body;

    if (!phone) {
        return res.status(400).json({ message: 'O número de telefone é obrigatório.' });
    }

    phone = cleanPhone(phone);

    try {
        const connection = await connect();
        try {
            const [existing] = await connection.query("SELECT * FROM customer_list WHERE phone = ?", [phone]);
            if (existing.length > 0) {
                const userInfo = existing[0];
                let updateFields = {};
                if (cpf && !userInfo.cpf) {
                    updateFields.cpf = cpf;
                }
                if (email && !userInfo.email) {
                    updateFields.email = email;
                }
                if (name && !userInfo.firstname) {
                    updateFields.firstname = name;
                }
                if (Object.keys(updateFields).length > 0) {
                    await connection.query("UPDATE customer_list SET ? WHERE phone = ?", [updateFields, phone]);
                    userInfo.cpf = updateFields.cpf || userInfo.cpf;
                    userInfo.email = updateFields.email || userInfo.email;
                    userInfo.firstname = updateFields.firstname || userInfo.firstname;
                }
                await connection.end();
                return res.json({ status: 'success', msg: 'Phone already exists.', userInfo });
            }

            let sql = "INSERT INTO customer_list SET ?";
            let data = { phone, cpf, email, firstname: name, ...otherData };
            const query = await connection.query(sql, data);
            const userId = query[0].insertId;

            // Recuperar as informações do novo usuário
            const [newUser] = await connection.query("SELECT * FROM customer_list WHERE id = ?", [userId]);
            const newUserInfo = newUser[0];

            res.json({ status: 'success', msg: 'User created successfully.', userInfo: newUserInfo });
        } finally {
            await connection.end();
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ status: 'failed', msg: error.message });
    }
});

module.exports = router;
