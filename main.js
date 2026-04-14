import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from "./src/firebase-config.js";

// Initialize Firebase
let db;
try {
    if (firebaseConfig.apiKey !== "PEGAR_AQUI") {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    }
} catch (e) {
    console.warn("Firestore not initialized.");
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

    /**
     * Handles the form submission
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!repairForm.checkValidity()) {
            repairForm.reportValidity();
            return;
        }

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const formData = new FormData(repairForm);
        const data = Object.fromEntries(formData.entries());
        
        const payload = {
            ...data,
            stage: 'solicitud',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'active'
        };

        try {
            if (db) {
                await addDoc(collection(db, "requests"), payload);
            } else {
                console.warn("Firebase no configurado. Simulando envío...");
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            showToast();
            repairForm.reset();
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

    repairForm.addEventListener('submit', handleSubmit);
});
