import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2EpLzJrcsTt7kK8sF_yzs7XJtl0R7Ybg",
    authDomain: "mymessenger-d6514.firebaseapp.com",
    projectId: "mymessenger-d6514",
    storageBucket: "mymessenger-d6514.firebasestorage.app",
    messagingSenderId: "677038576951",
    appId: "1:677038576951:web:4e23891c440def4260b6b2",
    measurementId: "G-YZ986P5D8K"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const adminUserIds = ["Xyz123abc456"]; // Замените на реальный UID администратора
const adminPassword = "Ubayda08";
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentFilter = 'all';
let currentSort = 'default';
let searchQuery = '';
let isAdminAuthenticated = false;

onAuthStateChanged(auth, (user) => {
    const profileLink = document.getElementById('profile-link');
    const adminLink = document.getElementById('admin-link');
    const ordersLink = document.getElementById('orders-link');
    const profileSection = document.querySelector('[data-section="profile"]');
    const authSection = document.getElementById('auth-section');
    const profileForm = document.getElementById('profile-form');
    const logoutButton = document.getElementById('logout-button');
    
    if (user) {
        profileLink.style.display = 'block';
        ordersLink.style.display = 'block';
        authSection.style.display = 'none';
        profileForm.style.display = 'block';
        logoutButton.style.display = 'block';
        if (adminUserIds.includes(user.uid)) {
            adminLink.style.display = 'block';
            loadAdminProducts();
            showNotification('Добро пожаловать, администратор!');
        }
        loadProfile(user.uid);
    } else {
        profileLink.style.display = 'none';
        adminLink.style.display = 'none';
        ordersLink.style.display = 'none';
        authSection.style.display = 'block';
        profileForm.style.display = 'none';
        logoutButton.style.display = 'none';
        isAdminAuthenticated = false;
    }
    loadProducts();
    loadOrders();
    updateStats();
});

document.getElementById('login-button').addEventListener('click', () => signInAnonymously(auth));
document.getElementById('signup-button').addEventListener('click', () => signInAnonymously(auth));
document.getElementById('logout-button').addEventListener('click', () => {
    signOut(auth);
    isAdminAuthenticated = false;
});

async function loadProducts() {
    try {
        const productGrid = document.getElementById('product-grid');
        productGrid.innerHTML = '';
        const productsCol = collection(db, 'products');
        const snapshot = await getDocs(productsCol);
        let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Фильтрация по категории
        if (currentFilter !== 'all') {
            products = products.filter(product => product.category === currentFilter);
        }
        
        // Поиск
        if (searchQuery) {
            products = products.filter(product => 
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.category.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        // Сортировка
        if (currentSort === 'price-asc') {
            products.sort((a, b) => a.price - b.price);
        } else if (currentSort === 'price-desc') {
            products.sort((a, b) => b.price - a.price);
        } else if (currentSort === 'date-desc') {
            products.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        }
        
        products.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product-card';
            productDiv.innerHTML = `
                <img src="${product.imageUrl}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>${product.price} сомони</p>
                <p>${product.description}</p>
                <button onclick="addToCart('${product.id}')">Добавить в корзину</button>
            `;
            productGrid.appendChild(productDiv);
        });
        loadCart();
    } catch (error) {
        showNotification('Ошибка загрузки товаров: ' + error.message);
    }
}

async function loadAdminProducts() {
    try {
        const adminProducts = document.getElementById('admin-products');
        adminProducts.innerHTML = '';
        const productsCol = collection(db, 'products');
        const snapshot = await getDocs(productsCol);
        snapshot.forEach(doc => {
            const data = doc.data();
            const productDiv = document.createElement('div');
            productDiv.className = 'product-card';
            productDiv.innerHTML = `
                <img src="${data.imageUrl}" alt="${data.name}">
                <h3>${data.name}</h3>
                <p>${data.price} сомони</p>
                <button onclick="editProduct('${doc.id}')">Редактировать</button>
                <button onclick="deleteProduct('${doc.id}')">Удалить</button>
            `;
            adminProducts.appendChild(productDiv);
        });
    } catch (error) {
        showNotification('Ошибка загрузки админ-панели: ' + error.message);
    }
}

window.addToCart = function(productId) {
    cart.push(productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    document.getElementById('cart-count').textContent = cart.length;
    loadCart();
    showNotification('Товар добавлен в корзину!');
};

async function loadCart() {
    try {
        const cartItems = document.getElementById('cart-items');
        const emptyCart = document.getElementById('empty-cart');
        cartItems.innerHTML = '';
        let total = 0;
        const productsCol = collection(db, 'products');
        const snapshot = await getDocs(productsCol);
        const productMap = {};
        snapshot.forEach(doc => productMap[doc.id] = doc.data());
        
        if (cart.length === 0) {
            emptyCart.style.display = 'block';
            cartItems.style.display = 'none';
            document.querySelector('.cart-total').style.display = 'none';
        } else {
            emptyCart.style.display = 'none';
            cartItems.style.display = 'block';
            document.querySelector('.cart-total').style.display = 'block';
            cart.forEach(productId => {
                const product = productMap[productId];
                if (product) {
                    total += product.price;
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'cart-item';
                    itemDiv.innerHTML = `
                        <img src="${product.imageUrl}" alt="${product.name}" style="max-width: 50px;">
                        <p>${product.name} - ${product.price} сомони</p>
                    `;
                    cartItems.appendChild(itemDiv);
                }
            });
        }
        document.getElementById('cart-total').textContent = total;
    } catch (error) {
        showNotification('Ошибка загрузки корзины: ' + error.message);
    }
}

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const name = document.getElementById('checkout-name').value;
        const address = document.getElementById('checkout-address').value;
        const productsCol = collection(db, 'products');
        const snapshot = await getDocs(productsCol);
        const productMap = {};
        snapshot.forEach(doc => productMap[doc.id] = doc.data());
        
        let orderDetails = `Заказ от ${name}\nАдрес: ${address}\nТовары:\n`;
        let total = 0;
        cart.forEach(productId => {
            const product = productMap[productId];
            if (product) {
                orderDetails += `${product.name} - ${product.price} сомони\n`;
                total += product.price;
            }
        });
        orderDetails += `Итого: ${total} сомони`;

        await addDoc(collection(db, 'orders'), {
            name,
            address,
            items: cart,
            total,
            timestamp: new Date(),
            userId: auth.currentUser?.uid || 'anonymous'
        });

        const whatsappLink = `https://wa.me/992905746633?text=${encodeURIComponent(orderDetails)}`;
        const telegramLink = `https://t.me/ubayda_1507?text=${encodeURIComponent(orderDetails)}`;
        window.open(whatsappLink, '_blank');
        window.open(telegramLink, '_blank');

        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        document.getElementById('cart-count').textContent = cart.length;
        loadCart();
        loadOrders();
        updateStats();
        showNotification('Заказ успешно отправлен!');
    } catch (error) {
        showNotification('Ошибка оформления заказа: ' + error.message);
    }
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const user = auth.currentUser;
        if (user) {
            const profileData = {
                name: document.getElementById('profile-name').value,
                address: document.getElementById('profile-address').value,
            };
            await addDoc(collection(db, 'users'), { uid: user.uid, ...profileData });
            loadProfile(user.uid);
            showNotification('Профиль сохранён!');
        }
    } catch (error) {
        showNotification('Ошибка сохранения профиля: ' + error.message);
    }
});

async function loadProfile(userId) {
    try {
        const profileName = document.getElementById('profile-name');
        const profileAddress = document.getElementById('profile-address');
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        const userDoc = snapshot.docs.find(doc => doc.data().uid === userId);
        if (userDoc) {
            const data = userDoc.data();
            profileName.value = data.name || '';
            profileAddress.value = data.address || '';
            document.getElementById('checkout-name').value = data.name || '';
            document.getElementById('checkout-address').value = data.address || '';
        }
    } catch (error) {
        showNotification('Ошибка загрузки профиля: ' + error.message);
    }
}

async function loadOrders() {
    try {
        const orderList = document.getElementById('order-list');
        const emptyOrders = document.getElementById('empty-orders');
        orderList.innerHTML = '';
        const ordersCol = collection(db, 'orders');
        const snapshot = await getDocs(ordersCol);
        const productsCol = collection(db, 'products');
        const productSnapshot = await getDocs(productsCol);
        const productMap = {};
        productSnapshot.forEach(doc => productMap[doc.id] = doc.data());

        if (snapshot.empty) {
            emptyOrders.style.display = 'block';
            orderList.style.display = 'none';
        } else {
            emptyOrders.style.display = 'none';
            orderList.style.display = 'block';
            snapshot.forEach(doc => {
                const data = doc.data();
                let orderItems = '';
                data.items.forEach(itemId => {
                    const product = productMap[itemId];
                    if (product) {
                        orderItems += `<p>${product.name} - ${product.price} сомони</p>`;
                    }
                });
                const orderDiv = document.createElement('div');
                orderDiv.className = 'order-card';
                orderDiv.innerHTML = `
                    <p><strong>Заказ от:</strong> ${data.name}</p>
                    <p><strong>Адрес:</strong> ${data.address}</p>
                    ${orderItems}
                    <p><strong>Итого:</strong> ${data.total} сомони</p>
                    <p><strong>Дата:</strong> ${new Date(data.timestamp.toDate()).toLocaleString()}</p>
                `;
                orderList.appendChild(orderDiv);
            });
        }
    } catch (error) {
        showNotification('Ошибка загрузки заказов: ' + error.message);
    }
}

async function updateStats() {
    try {
        const productsCol = collection(db, 'products');
        const ordersCol = collection(db, 'orders');
        const productSnapshot = await getDocs(productsCol);
        const orderSnapshot = await getDocs(ordersCol);
        document.getElementById('product-count').textContent = productSnapshot.size;
        document.getElementById('order-count').textContent = orderSnapshot.size;
    } catch (error) {
        showNotification('Ошибка обновления статистики: ' + error.message);
    }
}

document.getElementById('add-product-button').addEventListener('click', () => {
    if (isAdminAuthenticated) {
        document.getElementById('add-product-form').style.display = 'block';
    } else {
        document.getElementById('password-modal').style.display = 'block';
    }
});

document.getElementById('submit-password').addEventListener('click', () => {
    const password = document.getElementById('admin-password').value;
    if (password === adminPassword) {
        document.getElementById('password-modal').style.display = 'none';
        document.getElementById('add-product-form').style.display = 'block';
        document.getElementById('admin-password').value = '';
        showNotification('Доступ разрешён!');
    } else {
        showNotification('Неверный пароль!');
    }
});

document.getElementById('cancel-password').addEventListener('click', () => {
    document.getElementById('password-modal').style.display = 'none';
    document.getElementById('admin-password').value = '';
});

document.querySelectorAll('[data-protected="true"]').forEach(link => {
    link.addEventListener('click', (e) => {
        if (!isAdminAuthenticated && adminUserIds.includes(auth.currentUser?.uid)) {
            e.preventDefault();
            document.getElementById('password-modal').style.display = 'block';
            document.getElementById('submit-password').onclick = () => {
                const password = document.getElementById('admin-password').value;
                if (password === adminPassword) {
                    isAdminAuthenticated = true;
                    document.getElementById('password-modal').style.display = 'none';
                    document.getElementById('admin-password').value = '';
                    showNotification('Доступ к админ-панели разрешён!');
                    window.location.hash = '#admin';
                } else {
                    showNotification('Неверный пароль!');
                }
            };
        }
    });
});

document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const category = document.getElementById('product-category').value;
        const description = document.getElementById('product-description').value;
        const imageFile = document.getElementById('product-image').files[0];
        
        const imageRef = ref(storage, `products/${imageFile.name}`);
        await uploadBytes(imageRef, imageFile);
        const imageUrl = await getDownloadURL(imageRef);
        
        await addDoc(collection(db, 'products'), { 
            name, 
            price, 
            category, 
            description, 
            imageUrl, 
            timestamp: new Date() 
        });
        loadProducts();
        loadAdminProducts();
        updateStats();
        e.target.reset();
        document.getElementById('add-product-form').style.display = 'none';
        showNotification('Товар добавлен!');
    } catch (error) {
        showNotification('Ошибка добавления товара: ' + error.message);
    }
});

window.editProduct = async function(productId) {
    try {
        const productDoc = doc(db, 'products', productId);
        const product = await getDoc(productDoc);
        const data = product.data();
        document.getElementById('product-name').value = data.name;
        document.getElementById('product-price').value = data.price;
        document.getElementById('product-category').value = data.category;
        document.getElementById('product-description').value = data.description;
        document.getElementById('add-product-form').style.display = 'block';
        document.getElementById('add-product-form').onsubmit = async (e) => {
            e.preventDefault();
            try {
                const updatedData = {
                    name: document.getElementById('product-name').value,
                    price: parseFloat(document.getElementById('product-price').value),
                    category: document.getElementById('product-category').value,
                    description: document.getElementById('product-description').value,
                };
                if (document.getElementById('product-image').files[0]) {
                    const imageFile = document.getElementById('product-image').files[0];
                    const imageRef = ref(storage, `products/${imageFile.name}`);
                    await uploadBytes(imageRef, imageFile);
                    updatedData.imageUrl = await getDownloadURL(imageRef);
                }
                await updateDoc(productDoc, updatedData);
                loadProducts();
                loadAdminProducts();
                updateStats();
                e.target.reset();
                document.getElementById('add-product-form').style.display = 'none';
                document.getElementById('add-product-form').onsubmit = null;
                showNotification('Товар обновлён!');
            } catch (error) {
                showNotification('Ошибка обновления товара: ' + error.message);
            }
        };
    } catch (error) {
        showNotification('Ошибка редактирования товара: ' + error.message);
    }
};

window.deleteProduct = async function(productId) {
    if (confirm('Удалить товар?')) {
        try {
            await deleteDoc(doc(db, 'products', productId));
            loadProducts();
            loadAdminProducts();
            updateStats();
            showNotification('Товар удалён!');
        } catch (error) {
            showNotification('Ошибка удаления товара: ' + error.message);
        }
    }
};

document.querySelectorAll('.filter-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.filter;
        loadProducts();
    });
});

document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    loadProducts();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadProducts();
});

document.getElementById('view-orders-button').addEventListener('click', () => {
    window.location.hash = '#orders';
});

document.getElementById('export-data-button').addEventListener('click', async () => {
    try {
        const ordersCol = collection(db, 'orders');
        const snapshot = await getDocs(ordersCol);
        const data = snapshot.docs.map(doc => doc.data());
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'orders.json';
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Данные экспортированы!');
    } catch (error) {
        showNotification('Ошибка экспорта данных: ' + error.message);
    }
});

document.querySelector('.nav-toggle').addEventListener('click', () => {
    document.querySelector('nav ul').classList.toggle('active');
});

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
}

const themeButton = document.getElementById('theme-button');
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.body.classList.add('dark');
    themeButton.textContent = '☀️';
}
themeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    themeButton.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});
