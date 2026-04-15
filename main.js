import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./src/firebase-config.js";
import { notifyStage } from "./src/notifications.js";

// Initialize Firebase
let db;
try {
    if (firebaseConfig.apiKey !== "PEGAR_AQUI") {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    }
} catch (e) {
    console.warn("Firebase services not initialized.");
}

// Cloudinary config
const CLOUDINARY_CLOUD = 'dxskr1ce2';
const CLOUDINARY_PRESET = 'ml-default';

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('folder', 'repuesto-reparable');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudinary error ${res.status}: ${errText}`);
    }
    const json = await res.json();
    return json.secure_url;
}

document.addEventListener('DOMContentLoaded', () => {
    const repairForm = document.getElementById('repairForm');
    const submitBtn = document.getElementById('submitBtn');
    const toast = document.getElementById('toast');
    
    // Autocomplete elements
    const materialNameInput = document.getElementById('materialName');
    const materialCodeInput = document.getElementById('materialCode');
    const uomInput = document.getElementById('uom');
    const supplierNameInput = document.getElementById('supplierName');
    const sapCodeInput = document.getElementById('sapCode');
    
    // Master data arrays
    let materialsData = [];
    let suppliersData = [];

    // Navigation between Landing and Form
    function initNavigation() {
        const landingView = document.getElementById('view-landing');
        const formView = document.getElementById('view-form');
        const startBtn = document.getElementById('startBtn');
        const backBtn = document.getElementById('backBtn');

        if (startBtn && backBtn) {
            startBtn.addEventListener('click', () => {
                landingView.style.display = 'none';
                formView.style.display = 'block';
                
                // Absolute scroll reset after render
                requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                });
            });

            backBtn.addEventListener('click', () => {
                formView.style.display = 'none';
                landingView.style.display = 'flex';
                requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                });
            });
        }
    }

    // Logic for Reset Buttons (Borrachinha)
    function initClearButtons() {
        document.querySelectorAll('.btn-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening custom selects
                const targetId = btn.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                
                if (targetEl) {
                    targetEl.value = "";
                    targetEl.dispatchEvent(new Event('input'));
                    targetEl.dispatchEvent(new Event('change'));

                    if (targetId === 'materialName') {
                        document.getElementById('materialCode').value = "";
                        document.getElementById('uom').value = "";
                    }
                    if (targetId === 'supplierName') {
                        document.getElementById('sapCode').value = "";
                    }

                    const customWrapper = targetEl.closest('.custom-select');
                    if (customWrapper) {
                        const text = customWrapper.querySelector('.selected-text');
                        if (targetId === 'uom') text.textContent = "Seleccione...";
                        if (targetId === 'category') text.textContent = "Seleccione una categoría";
                        customWrapper.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
                    }
                }
            });
        });
    }

    initNavigation();
    initClearButtons();

    // Fetch Master Data
    if (db) {
        onSnapshot(query(collection(db, "materials"), orderBy("name")), (snapshot) => {
            const list = document.getElementById('materialsList');
            list.innerHTML = "";
            materialsData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                materialsData.push(data);
                const option = document.createElement('option');
                option.value = data.name;
                list.appendChild(option);
            });
        });

        onSnapshot(query(collection(db, "suppliers"), orderBy("name")), (snapshot) => {
            const list = document.getElementById('suppliersList');
            list.innerHTML = "";
            suppliersData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                suppliersData.push(data);
                const option = document.createElement('option');
                option.value = data.name;
                list.appendChild(option);
            });
        });
    }

    // Auto-fill logic for Materials (includes UOM)
    materialNameInput.addEventListener('input', (e) => {
        const selected = materialsData.find(m => m.name === e.target.value);
        if (selected) {
            materialCodeInput.value = selected.code;
            uomInput.value = (selected.uom || "").toUpperCase();
        } else {
            materialCodeInput.value = "";
            uomInput.value = "";
        }
    });

    // Auto-fill logic for Suppliers
    supplierNameInput.addEventListener('input', (e) => {
        const selected = suppliersData.find(s => s.name === e.target.value);
        sapCodeInput.value = selected ? selected.sapCode : "";
    });

    // Logic for Custom Selects
    function initCustomSelects() {
        document.querySelectorAll('.custom-select').forEach(wrapper => {
            const trigger = wrapper.querySelector('.select-trigger');
            const options = wrapper.querySelectorAll('.option');
            const hiddenSelect = wrapper.querySelector('select');
            const selectedText = wrapper.querySelector('.selected-text');

            trigger.addEventListener('click', () => {
                // Close other selects
                document.querySelectorAll('.custom-select').forEach(other => {
                    if (other !== wrapper) other.classList.remove('active');
                });
                wrapper.classList.toggle('active');
            });

            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    const val = opt.getAttribute('data-value');
                    hiddenSelect.value = val;
                    selectedText.textContent = opt.textContent;
                    
                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    wrapper.classList.remove('active');

                    // Trigger change event for auto-fill logic if needed
                    hiddenSelect.dispatchEvent(new Event('change'));
                });
            });
        });

        // Close when clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-select')) {
                document.querySelectorAll('.custom-select').forEach(w => w.classList.remove('active'));
            }
        });
    }

    initCustomSelects();

    /**
     * Handles the form submission
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData(repairForm);
        const data = Object.fromEntries(formData.entries());
        delete data.attachment; // File objects não são aceitos pelo Firestore
        const submitBtn = repairForm.querySelector('button[type="submit"]');

        try {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;

            let attachmentUrl = null;
            const attachmentFile = document.getElementById('attachment').files[0];
            
            if (attachmentFile) {
                try {
                    attachmentUrl = await uploadToCloudinary(attachmentFile);
                } catch (uploadErr) {
                    console.warn('Upload de arquivo falhou, continuando sem anexo:', uploadErr.message);
                }
            }

            if (db) {
                const payload = {
                    ...data,
                    attachmentUrl,
                    repairCost: 0, // Inicialmente zero
                    stage: 'solicitud',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    status: 'active'
                };

                await addDoc(collection(db, "requests"), payload);
                // Notificar responsáveis da etapa de Manutenção (primeira etapa técnica)
                notifyStage(db, 'manutencion', payload);
            } else {
                console.warn("Firebase no configurado. Simulando envío...");
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            showToast();
            repairForm.reset();
            document.getElementById('fileNameDisplay').textContent = "Escolher archivo o arrastrar aquí...";
            // Reset custom selects
            document.querySelectorAll('.selected-text').forEach(st => {
                if (st.closest('#custom-uom')) st.textContent = "Seleccione...";
                if (st.closest('#custom-category')) st.textContent = "Seleccione una categoría";
            });
            document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            
            // Return to landing after pulse
            setTimeout(() => {
                formView.style.display = 'none';
                landingView.style.display = 'flex';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 2000);
            
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            alert("Hubo un error al enviar la solicitud.");
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    };

    const showToast = () => {
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 5000);
    };

    // File name feedback logic
    const attachmentInput = document.getElementById('attachment');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (attachmentInput && fileNameDisplay) {
        attachmentInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0]?.name || "Escolher archivo o arrastrar aquí...";
            fileNameDisplay.textContent = fileName;
        });
    }

    repairForm.addEventListener('submit', handleSubmit);
});
