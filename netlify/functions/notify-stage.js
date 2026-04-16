const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Helper to initialize Admin SDK
function initAdmin() {
    if (admin.apps.length === 0) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
            throw new Error('Falha na configuração do servidor (Firebase Admin)');
        }
    }
    return admin.firestore();
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método não permitido' };
    }

    try {
        const { stageId, data } = JSON.parse(event.body);
        const db = initAdmin();

        // 1. Get recipients from Firestore (Secured server-side access)
        const stageSnap = await db.collection('workflow_roles').doc(stageId).get();
        if (!stageSnap.exists) {
            return { 
                statusCode: 200, 
                body: JSON.stringify({ message: `Nenhum responsável configurado para a etapa: ${stageId}` }) 
            };
        }

        const users = stageSnap.data().users || [];
        if (users.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ message: 'Lista de e-mails vazia' }) };
        }

        // 2. Prepare Email Transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const stageNames = {
            'solicitud': 'Solicitud Inicial',
            'manutencion': 'Manutenção / Envío',
            'emision-nf': 'Emissão de NF',
            'proveedor': 'Proveedor / Taller',
            'propuesta': 'Aprovação de Proposta'
        };

        const subject = `[Repuesto Reparable] Ação Necessária: ${stageNames[stageId] || stageId}`;
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden;">
                <div style="background-color: #76b82a; padding: 20px; text-align: center; color: white;">
                    <h2 style="margin: 0;">Repuesto Reparable</h2>
                </div>
                <div style="padding: 20px; line-height: 1.6; color: #44474e;">
                    <p>Hola,</p>
                    <p>Hay una solicitud que requiere su atención na etapa de <strong>${stageNames[stageId] || stageId}</strong>.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>OM:</strong> ${data.om || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Material:</strong> ${data.materialName || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Proveedor Sugerido:</strong> ${data.supplierName || 'N/A'}</p>
                    </div>

                    <p>Por favor, acesse o painel administrativo para realizar a ação necessária.</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://repuestoreparablecmpc.netlify.app/admin.html" style="background-color: #76b82a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold;">Acessar Painel Admin</a>
                    </div>
                </div>
                <div style="background-color: #f1f3fc; padding: 15px; text-align: center; font-size: 12px; color: #74777f;">
                    Este é um e-mail automático do sistema Repuesto Reparable CMPC.
                </div>
            </div>
        `;

        // 3. Send emails
        const emailPromises = users.map(user => {
            return transporter.sendMail({
                from: `"Repuesto Reparable" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject,
                html
            });
        });

        await Promise.all(emailPromises);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Notificações enviadas para ${users.length} pessoa(s).` }),
        };

    } catch (error) {
        console.error('Error processing notification:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erro interno ao processar notificação' }),
        };
    }
};
