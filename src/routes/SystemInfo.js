const express = require('express');
const router = express.Router();
const multer = require('multer');
const CryptoJS = require('crypto-js');
const storage = multer.memoryStorage();
const upload = multer({ storage });

const encryptionKey = 'bW9kZWxpbmcgdGhlIGZ1dHVyZSB3aXRoIGFuIGF1dG9tYXRlZCBzZWN1cml0eSBzZWNyZXQga2V5Cg==';

router.get('/system-info', async (req, res) => {
    const connection = req.db;
    try {
        const [rows] = await connection.execute(`
            SELECT meta_field, meta_value 
            FROM system_info 
            WHERE meta_field IN (
                'name', 
                'email', 
                'phone', 
                'logo', 
                'favicon', 
                'enable_cpf', 
                'enable_phone_verification', 
                'enable_email', 
                'telegram_group_url', 
                'whatsapp_group_url', 
                'enable_groups', 
                'enable_share', 
                'enable_conversion_api', 
                'facebook_access_token', 
                'facebook_pixel_id', 
                'order_quantity'
            )
        `);

        const maskedData = rows.map((item) => {
            if (item.meta_field === 'facebook_access_token' || item.meta_field === 'facebook_pixel_id') {
                const value = item.meta_value;
                if (value.length > 4) {
                    // Mascarar todos os caracteres, exceto os últimos 4
                    item.meta_value = '*'.repeat(value.length - 4) + value.slice(-4);
                }
            }
            return item;
        });

        return res.json({ status: 'success', data: maskedData });
    } catch (error) {
        console.error('Database query failed', error);
        return res.status(500).json({ status: 'failed', message: 'Internal server error.' });
    }
});



router.post('/save-settings', upload.fields([{ name: 'logo' }, { name: 'favicon' }]), async (req, res) => {
    const {
        name,
        email,
        phone,
        telegram_group_url,
        whatsapp_group_url,
        enable_cpf,
        enable_phone_verification,
        enable_email,
        enable_groups,
        enable_share,
        enable_conversion_api,
        facebook_access_token,
        facebook_pixel_id,
        order_quantity 
    } = req.body;

    const connection = req.db;

    try {
        const updateOrInsert = async (meta_field, meta_value) => {
            const [rows] = await connection.execute(`
                SELECT * FROM system_info WHERE meta_field = ?
            `, [meta_field]);

            if (rows.length > 0) {
                await connection.execute(`
                    UPDATE system_info SET meta_value = ? WHERE meta_field = ?
                `, [meta_value, meta_field]);
            } else {
                await connection.execute(`
                    INSERT INTO system_info (meta_field, meta_value) VALUES (?, ?)
                `, [meta_field, meta_value]);
            }
        };

        await updateOrInsert('name', name);
        await updateOrInsert('email', email);
        await updateOrInsert('phone', phone);
        await updateOrInsert('telegram_group_url', telegram_group_url);
        await updateOrInsert('whatsapp_group_url', whatsapp_group_url);
        await updateOrInsert('enable_cpf', enable_cpf === '1' ? '1' : '2');
        await updateOrInsert('enable_phone_verification', enable_phone_verification === '1' ? '1' : '2');
        await updateOrInsert('enable_email', enable_email === '1' ? '1' : '2');
        await updateOrInsert('enable_groups', enable_groups === '1' ? '1' : '2');
        await updateOrInsert('enable_share', enable_share === '1' ? '1' : '2');
        await updateOrInsert('enable_conversion_api', enable_conversion_api === '1' ? '1' : '2');
        await updateOrInsert('facebook_access_token', facebook_access_token);
        await updateOrInsert('facebook_pixel_id', facebook_pixel_id);
        await updateOrInsert('order_quantity', order_quantity); // Salvando order_quantity

        if (req.files && req.files.logo) {
            const logo = req.files.logo[0];
            const logoBase64 = logo.buffer.toString('base64');
            await updateOrInsert('logo', logoBase64);
        }

        if (req.files && req.files.favicon) {
            const favicon = req.files.favicon[0];
            const faviconBase64 = favicon.buffer.toString('base64');
            await updateOrInsert('favicon', faviconBase64);
        }

        return res.json({ status: 'success', message: 'Settings saved successfully.' });
    } catch (error) {
        console.error('Database query failed', error);
        return res.status(500).json({ status: 'failed', message: 'Internal server error.' });
    }
});


module.exports = router;
