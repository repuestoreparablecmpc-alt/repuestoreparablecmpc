import { loginWithGoogle, logout, onAuth } from "./auth.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy, writeBatch, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./auth.js"; 

const db = getFirestore(auth.app);

const STAGES = {
    SOLICITUD: 'solicitud',
    EMISION_NF: 'emision-nf',
    PROVEEDOR: 'proveedor',
    PROPUESTA: 'propuesta'
};

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginOverlay = document.getElementById('loginOverlay');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminEmailSpan = document.getElementById('adminEmail');
    const errorMsg = document.getElementById('errorMsg');
    
    // Auth Logic
    onAuth((user) => {
        if (user) {
            loginOverlay.style.display = 'none';
            adminEmailSpan.textContent = user.email;
            initDashboard();
        } else {
            loginOverlay.style.display = 'flex';
        }
    });

    loginBtn.addEventListener('click', async () => {
        try {
            errorMsg.textContent = "";
            await loginWithGoogle();
        } catch (e) {
            errorMsg.textContent = e.message;
        }
    });

    logoutBtn.addEventListener('click', logout);

    // Tab Logic
    const tabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.admin-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`section-${tab.dataset.target}`).classList.add('active');
        });
    });

    // Dashboard Initialization
    function initDashboard() {
        if (!db) return;

        // Subscriptions
        subscribeToCollection("requests", orderBy("createdAt", "desc"), renderRequests);
        subscribeToCollection("suppliers", orderBy("name"), renderSuppliers);
        subscribeToCollection("materials", orderBy("name"), renderMaterials);
        subscribeToCollection("workflow_roles", null, renderRoles);

        // Renderização inicial forçada para evitar tela branca
        renderRoles();
    }

    function subscribeToCollection(coll, order, renderer) {
        const q = order ? query(collection(db, coll), order) : collection(db, coll);
        onSnapshot(q, 
            (snapshot) => renderer(snapshot),
            (error) => {
                console.error(`Error de lectura en ${coll}:`, error);
                if (error.code === 'permission-denied') {
                    alert(`Acceso denegado a la colección "${coll}". Revisa tus Reglas de Firestore.`);
                }
            }
        );
    }

    // Renderers
    function renderRequests(snapshot) {
        Object.values(STAGES).forEach(stage => {
            document.getElementById(`list-${stage}`).innerHTML = "";
            document.querySelector(`[data-stage="${stage}"] .countBadge`).textContent = "0";
        });

        const counts = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const stage = data.stage || STAGES.SOLICITUD;
            counts[stage] = (counts[stage] || 0) + 1;
            
            const cardDate = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Pendiente...';
            
            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div class="card-id">#${doc.id.slice(-6).toUpperCase()}</div>
                <div class="card-title">OM: ${data.om}</div>
                <div class="card-meta">
                    <span>${data.materialName || 'Sin nombre'}</span>
                    <span>${cardDate}</span>
                </div>
            `;
            card.onclick = () => showDetails(doc.id, data);
            document.getElementById(`list-${stage}`).appendChild(card);
        });

        Object.entries(counts).forEach(([stage, count]) => {
            document.querySelector(`[data-stage="${stage}"] .countBadge`).textContent = count;
        });
    }

    function renderSuppliers(snapshot) {
        const tbody = document.getElementById('supplierTableBody');
        tbody.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.name}</td>
                <td>${data.sapCode}</td>
                <td><small>${data.email || 'N/A'}</small></td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td><button class="btn-secondary btn-small" onclick="deleteItem('suppliers', '${doc.id}')">Eliminar</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderMaterials(snapshot) {
        const tbody = document.getElementById('materialTableBody');
        tbody.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.code}</td>
                <td>${data.name}</td>
                <td>${data.uom || 'N/A'}</td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td><button class="btn-secondary btn-small" onclick="deleteItem('materials', '${doc.id}')">Eliminar</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderRoles(snapshot) {
        const grid = document.getElementById('rolesGrid');
        if (!grid) {
            console.warn("Elemento 'rolesGrid' não encontrado.");
            return;
        }
        grid.innerHTML = "";
        
        const roleData = {};
        if (snapshot && typeof snapshot.forEach === 'function') {
            snapshot.forEach(doc => roleData[doc.id] = doc.data().users || []);
        }

        console.log("Renderizando Roles para stages:", STAGES);

        Object.entries(STAGES).forEach(([key, stageId]) => {
            const users = roleData[stageId] || [];
            const card = document.createElement('div');
            card.className = 'board-column';
            card.innerHTML = `
                <div class="column-header">
                    <h3>${key.replace('_', ' ')}</h3>
                </div>
                <div class="role-user-list">
                    ${users.length > 0 ? users.map(u => `
                        <div class="role-user-item">
                            <div class="role-user-info">
                                <span class="role-user-name">${u.name}</span>
                                <span class="role-user-email">${u.email}</span>
                            </div>
                            <button class="btn-remove-role" onclick="removeUserFromRole('${stageId}', '${u.email}')">&times;</button>
                        </div>
                    `).join('') : '<p style="font-size:12px; color:var(--text-secondary); padding: 10px;">Sin responsables asignados</p>'}
                </div>
                <button class="btn-add-role" onclick="openAddRoleModal('${stageId}')">+ Agregar Responsable</button>
            `;
            grid.appendChild(card);
        });
    }

    // Modal Logic
    const modals = {
        details: document.getElementById('detailsModal'),
        supplier: document.getElementById('supplierModal'),
        material: document.getElementById('materialModal'),
        bulk: document.getElementById('bulkModal'),
        role: document.getElementById('roleModal')
    };

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => Object.values(modals).forEach(m => m.style.display = "none");
    });

    document.getElementById('addSupplierBtn').onclick = () => modals.supplier.style.display = "flex";
    document.getElementById('addMaterialBtn').onclick = () => modals.material.style.display = "flex";

    // Form Submissions
    document.getElementById('supplierForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        try {
            btn.disabled = true;
            const data = Object.fromEntries(new FormData(e.target).entries());
            await addDoc(collection(db, "suppliers"), { ...data, status: 'active', createdAt: new Date() });
            e.target.reset();
            modals.supplier.style.display = "none";
            alert("Proveedor guardado con éxito.");
        } catch (error) {
            console.error("Error al guardar proveedor:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            btn.disabled = false;
        }
    };

    document.getElementById('materialForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        try {
            btn.disabled = true;
            const data = Object.fromEntries(new FormData(e.target).entries());
            await addDoc(collection(db, "materials"), { ...data, status: 'active', createdAt: new Date() });
            e.target.reset();
            modals.material.style.display = "none";
            alert("Material guardado con éxito.");
        } catch (error) {
            console.error("Error al guardar material:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            btn.disabled = false;
        }
    };

    window.openAddRoleModal = (stageId) => {
        document.getElementById('roleStageId').value = stageId;
        modals.role.style.display = "flex";
    };

    document.getElementById('roleForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const formData = Object.fromEntries(new FormData(e.target).entries());
        const { stageId, name, email } = formData;

        try {
            btn.disabled = true;
            const stageRef = doc(db, "workflow_roles", stageId);
            
            // Usamos setDoc com merge: true para criar o doc caso não exista e adicionar ao array
            await setDoc(stageRef, {
                users: arrayUnion({ name, email })
            }, { merge: true });

            e.target.reset();
            modals.role.style.display = "none";
        } catch (error) {
            console.error("Error al asignar rol:", error);
            alert("Error: " + error.message);
        } finally {
            btn.disabled = false;
        }
    };

    window.removeUserFromRole = async (stageId, email) => {
        // Para remover um objeto do array no Firestore, precisamos do objeto exato ou ler o documento
        if (!confirm(`¿Eliminar a este responsable?`)) return;
        
        try {
            const stageRef = doc(db, "workflow_roles", stageId);
            // Como não temos o nome fácil aqui sem o cache, vamos fazer um get rápido
            // (Melhor prática se o cache local não estiver disponível)
            const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const docSnap = await getDoc(stageRef);
            if (docSnap.exists()) {
                const users = docSnap.data().users || [];
                const userToRemove = users.find(u => u.email === email);
                if (userToRemove) {
                    await updateDoc(stageRef, {
                        users: arrayRemove(userToRemove)
                    });
                }
            }
        } catch (error) {
            console.error("Error al eliminar rol:", error);
        }
    };

    // Bulk Import Logic
    let currentBulkType = '';
    const bulkModal = modals.bulk;
    const bulkTextarea = document.getElementById('bulkTextarea');
    const bulkTitle = document.getElementById('bulkTitle');
    const bulkInstructions = document.getElementById('bulkInstructions');
    const bulkStatus = document.getElementById('bulkStatus');

    document.getElementById('bulkSupplierBtn').onclick = () => {
        currentBulkType = 'suppliers';
        bulkTitle.textContent = "Carga Masiva de Proveedores";
        bulkInstructions.textContent = "Formato esperado (Excel): ID | Nombre | Código SAP | Correo";
        bulkModal.style.display = "flex";
    };

    document.getElementById('bulkMaterialBtn').onclick = () => {
        currentBulkType = 'materials';
        bulkTitle.textContent = "Carga Masiva de Materiales";
        bulkInstructions.textContent = "Formato esperado (Excel): Código | Nombre | Unidad de Medida (UM)";
        bulkModal.style.display = "flex";
    };

    document.getElementById('processBulkBtn').onclick = async (e) => {
        const text = bulkTextarea.value.trim();
        if (!text) return;

        const btn = e.target;
        const lines = text.split('\n');
        const batch = writeBatch(db);
        let count = 0;

        try {
            btn.disabled = true;
            btn.textContent = "Procesando...";
            bulkStatus.textContent = "Cargando datos...";

            lines.forEach(line => {
                const parts = line.split('\t'); 
                if (parts.length >= 3) {
                    const docRef = doc(collection(db, currentBulkType));
                    let payload = {};
                    
                    if (currentBulkType === 'suppliers') {
                        payload = {
                            supplierId: parts[0].trim(),
                            name: parts[1].trim(),
                            sapCode: parts[2].trim(),
                            email: parts[3]?.trim() || '',
                            status: 'active',
                            createdAt: new Date()
                        };
                    } else {
                        payload = {
                            code: parts[0].trim(),
                            name: parts[1].trim(),
                            uom: parts[2].trim(),
                            status: 'active',
                            createdAt: new Date()
                        };
                    }
                    batch.set(docRef, payload);
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                alert(`¡Éxito! Se han cargado ${count} registros.`);
                bulkTextarea.value = "";
                modals.bulk.style.display = "none";
            } else {
                alert("No se encontró información válida en el pegado. Asegúrate de copiar desde Excel.");
            }
        } catch (error) {
            console.error("Error en carga masiva:", error);
            alert("Error en carga masiva: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Procesar Carga";
            bulkStatus.textContent = "";
        }
    };

    // Deletion
    window.deleteItem = async (coll, id) => {
        if (confirm("¿Eliminar este registro?")) {
            await deleteDoc(doc(db, coll, id));
        }
    };

    // Details/Workflow
    let currentSelectedId = null, currentSelectedData = null;
    function showDetails(id, data) {
        currentSelectedId = id; currentSelectedData = data;
        const isSolicitud = data.stage === STAGES.SOLICITUD;
        modals.details.style.display = "flex";
        document.getElementById('modalBody').innerHTML = `
            <h3>Detalles de Solicitud</h3>
            <p><strong>OM:</strong> ${data.om}</p>
            <p><strong>Material:</strong> ${data.materialName} (${data.materialCode})</p>
            <p><strong>${isSolicitud ? 'Proveedor Sugerido' : 'Proveedor'}:</strong> ${data.supplierName} (${data.sapCode})</p>
            <p><strong>UM:</strong> ${data.uom} | <strong>Cant:</strong> ${data.quantity}</p>
            <p><strong>Estado Actual:</strong> <span class="badge">${data.stage.toUpperCase()}</span></p>
        `;
        const nextBtn = document.getElementById('nextStageBtn');
        const decPanel = document.querySelector('.decision-btns');
        if (data.stage === STAGES.PROPUESTA) {
            nextBtn.style.display = 'none'; decPanel.style.display = 'flex';
        } else {
            nextBtn.style.display = 'block'; decPanel.style.display = 'none';
        }
    }

    document.getElementById('nextStageBtn').onclick = async () => {
        const nextMap = { [STAGES.SOLICITUD]: STAGES.EMISION_NF, [STAGES.EMISION_NF]: STAGES.PROVEEDOR, [STAGES.PROVEEDOR]: STAGES.PROPUESTA };
        if (nextMap[currentSelectedData.stage]) {
            await updateDoc(doc(db, "requests", currentSelectedId), { stage: nextMap[currentSelectedData.stage], updatedAt: new Date() });
            modals.details.style.display = "none";
        }
    };

    document.getElementById('acceptBtn').onclick = () => finishRequest('aceptado');
    document.getElementById('rejectBtn').onclick = () => finishRequest('rechazado');

    async function finishRequest(status) {
        await updateDoc(doc(db, "requests", currentSelectedId), { status, updatedAt: new Date() });
        modals.details.style.display = "none";
    }
});
