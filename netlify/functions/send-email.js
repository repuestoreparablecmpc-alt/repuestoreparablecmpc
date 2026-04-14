const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método no permitido' };
    }

    try {
        const { to, subject, html } = JSON.parse(event.body);

        // Configure transporter with Gmail
        // Estos valores se configuran en el panel de Netlify (Environment Variables)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Contraseña de aplicación
            },
        });

        const mailOptions = {
            from: `"Repuesto Reparable" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        };

        await transporter.sendMail(mailOptions);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Correo enviado con éxito' }),
        };
    } catch (error) {
        console.error('Error enviando correo:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al enviar el correo' }),
        };
    }
};
