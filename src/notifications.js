import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Envia notificações para os responsáveis de uma determinada etapa
 * @param {object} db - Instância do Firestore
 * @param {string} stageId - ID da etapa (ex: 'manutencion')
 * @param {object} data - Dados da solicitação (om, materialName, etc)
 */
export async function notifyStage(db, stageId, data) {
    try {
        const stageRef = doc(db, "workflow_roles", stageId);
        const stageSnap = await getDoc(stageRef);

        if (!stageSnap.exists()) {
            console.warn(`Nenhum responsável configurado para a etapa: ${stageId}`);
            return;
        }

        const users = stageSnap.data().users || [];
        if (users.length === 0) return;

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
                        <p style="margin: 5px 0;"><strong>OM:</strong> ${data.om}</p>
                        <p style="margin: 5px 0;"><strong>Material:</strong> ${data.materialName} (${data.materialCode})</p>
                        <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${data.supplierName}</p>
                        <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${data.priority || 'Normal'}</p>
                    </div>

                    <p>Por favor, acesse o painel administrativo para realizar a ação necessária.</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://repuestoreparable.netlify.app/admin.html" style="background-color: #76b82a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold;">Acessar Painel Admin</a>
                    </div>
                </div>
                <div style="background-color: #f1f3fc; padding: 15px; text-align: center; font-size: 12px; color: #74777f;">
                    Este é um e-mail automático do sistema Repuesto Reparable CMPC.
                </div>
            </div>
        `;

        // Dispara e-mails para todos os responsáveis
        const emailPromises = users.map(user => {
            console.log(`Disparando e-mail para ${user.email} (Etapa: ${stageId})`);
            return fetch('/.netlify/functions/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: user.email,
                    subject,
                    html
                })
            });
        });

        await Promise.all(emailPromises);
        console.log(`Notificações enviadas com sucesso para a etapa ${stageId}`);

    } catch (error) {
        console.error("Erro ao enviar notificações:", error);
    }
}
