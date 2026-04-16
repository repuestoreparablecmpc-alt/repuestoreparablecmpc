/**
 * Notifica os responsáveis de uma etapa via servidor (Netlify Function)
 * @param {object} db - (Opcional, mantido por compatibilidade) Instância do Firestore
 * @param {string} stageId - ID da etapa (ex: 'manutencion')
 * @param {object} data - Dados da solicitação (om, materialName, etc)
 */
export async function notifyStage(db, stageId, data) {
    try {
        console.log(`Solicitando notificação para a etapa: ${stageId}`);

        const response = await fetch('/.netlify/functions/notify-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stageId,
                data
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao processar notificação no servidor');
        }

        const result = await response.json();
        console.log('Servidor processou as notificações:', result.message);

    } catch (error) {
        console.error("Erro ao disparar notificações via servidor:", error);
    }
}
