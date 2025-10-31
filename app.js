// --- 1. НАЛАШТУВАННЯ ---
const API_URL = "https://zhadkivski-shop.servegame.com";
const STATIC_URL = `${API_URL}/static/`;
const tg = window.Telegram.WebApp;

// --- Елементи сторінки ---
const appContainer = document.getElementById('app');
// Форма для нового клієнта
const orderFormContainer = document.getElementById('order-form-container');
const orderForm = document.getElementById('order-form');
// Форма для існуючого клієнта (нова)
const profileConfirmContainer = document.getElementById('profile-confirm-container');
const profileDataDisplay = document.getElementById('profile-data-display');
const deliveryTimeProfileInput = document.getElementById('delivery_time_profile');
const confirmUseProfileBtn = document.getElementById('confirm-use-profile');
const confirmNewDataBtn = document.getElementById('confirm-new-data');
const backToCartBtn = document.getElementById('back-to-cart-btn');

// --- Глобальні змінні ---
let cart = {}; 
let productsCache = {};
let userProfile = {}; // Зберігаємо профіль користувача тут
let currentView = 'categories';

// --- 2. ГОЛОВНА ЛОГІКА (ЗАПУСК) ---
tg.ready();
loadCategories();

tg.MainButton.setText("🛒 Переглянути кошик");
tg.MainButton.onClick(showCartSummary);

// --- 3. ФУНКЦІЇ НАВІГАЦІЇ ТА ВІДОБРАЖЕННЯ ---

async function loadCategories() {
    currentView = 'categories';
    showLoader();
    try {
        const response = await fetch(`${API_URL}/api/categories`);
        const categories = await response.json();
        
        appContainer.innerHTML = '<h2>Оберіть категорію:</h2>';
        const grid = document.createElement('div');
        grid.className = 'grid-container';

        if (!categories || categories.length === 0) {
            grid.innerHTML = "<p>Категорій поки що немає.</p>";
        } else {
            categories.forEach(([id, name]) => {
                grid.innerHTML += `
                    <div class="category-btn" onclick="loadProducts(${id})">
                        ${name}
                    </div>
                `;
            });
        }
        appContainer.appendChild(grid);
    } catch (e) {
        showError("Помилка завантаження категорій.");
        console.error(e);
    }
    showScreen('app');
    updateMainButton();
}

async function loadProducts(categoryId) {
    currentView = 'products';
    showLoader();
    try {
        const response = await fetch(`${API_URL}/api/products/${categoryId}`);
        const products = await response.json();

        appContainer.innerHTML = `
            <div class="controls">
                <button class="btn-back" onclick="loadCategories()">⬅️ Назад до категорій</button>
            </div>
            <h2>Товари:</h2>
        `;
        const grid = document.createElement('div');
        grid.className = 'grid-container';

        if (!products || products.length === 0) {
            grid.innerHTML = "<p>В цій категорії товарів немає.</p>";
        } else {
            products.forEach(prod => {
                productsCache[prod.id] = prod; 
                const photoUrl = prod.photo_url ? `${STATIC_URL}${prod.photo_url}` : 'https://via.placeholder.com/150';
                const inStock = prod.stock > 0;
                
                grid.innerHTML += `
                    <div class="product-card">
                        <img src="${photoUrl}" alt="${prod.name}">
                        <div class="product-info">
                            <div class="product-name">${prod.name}</div>
                            <div class="product-price">${prod.price} грн</div>
                            <div class="product-stock">${inStock ? `В наявності: ${prod.stock} шт.` : 'Немає в наявності'}</div>
                            <button class="btn-add-to-cart" id="btn-prod-${prod.id}" 
                                    onclick="addToCart(${prod.id})" ${!inStock ? 'disabled' : ''}>
                                ${cart[prod.id] ? `У кошику: ${cart[prod.id]}` : (inStock ? 'Додати в кошик' : 'Немає')}
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        appContainer.appendChild(grid);
    } catch (e) {
        showError("Помилка завантаження товарів.");
        console.error(e);
    }
    showScreen('app');
    updateMainButton();
}

// --- 4. ЛОГІКА КОШИКА ---

function addToCart(productId) {
    const product = productsCache[productId];
    if (!product) return;

    let quantityInCart = cart[productId] || 0;

    if (quantityInCart >= product.stock) {
        tg.showAlert(`Вибачте, але на складі маємо всього ${product.stock} шт 😢`);
        return;
    }
    cart[productId] = quantityInCart + 1;
    tg.HapticFeedback.notificationOccurred('success');
    
    const btn = document.getElementById(`btn-prod-${productId}`);
    if (btn) btn.innerText = `У кошику: ${cart[productId]}`;
    
    updateMainButton();
}

function removeFromCart(productId) {
    if (cart[productId]) {
        delete cart[productId];
        tg.HapticFeedback.notificationOccurred('warning');
        showCartSummary(); // Оновити вигляд кошика
    }
}

function updateMainButton() {
    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

    if (totalItems > 0) {
        if (currentView === 'cart') {
            tg.MainButton.setText("✅ Перейти до оформлення");
        } else {
            tg.MainButton.setText(`🛒 Кошик (${totalItems} товар${totalItems === 1 ? '' : 'и'})`);
        }
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
}

function showCartSummary() {
    if (Object.keys(cart).length === 0) {
        tg.showAlert("Ваш кошик порожній.");
        return;
    }

    if (currentView !== 'cart') {
        currentView = 'cart';
        showLoader();
        appContainer.innerHTML = '<h2>🛒 Ваш кошик:</h2>';
        
        let totalPrice = 0;
        const cartItemsContainer = document.createElement('div');
        
        for (const productId in cart) {
            const product = productsCache[productId];
            const quantity = cart[productId];
            if (!product) continue;
            
            const itemPrice = product.price * quantity;
            totalPrice += itemPrice;
            
            cartItemsContainer.innerHTML += `
                <div class="cart-item">
                    <b>${product.name}</b>
                    <p>${quantity} шт. x ${product.price} грн = ${itemPrice} грн</p>
                    <button onclick="removeFromCart(${productId})">Видалити</button>
                </div>
                <hr>
            `;
        }
        
        appContainer.appendChild(cartItemsContainer);
        appContainer.innerHTML += `<h3>Загальна сума: ${totalPrice} грн</h3>`;
        
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        backBtn.innerText = '⬅️ Назад до категорій';
        backBtn.onclick = loadCategories;
        appContainer.prepend(backBtn);
        
        showScreen('app');
        updateMainButton();
    } else {
        // Ми ВЖЕ в кошику, і юзер тисне "Перейти до оформлення"
        startCheckout();
    }
}

// --- 5. ЛОГІКА ОФОРМЛЕННЯ ЗАМОВЛЕННЯ (ОНОВЛЕНО) ---

// Крок 1: Вирішуємо, який екран показати (форму чи профіль)
async function startCheckout() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (!userId) {
        showOrderForm(); // Якщо не можемо отримати ID, показуємо пусту форму
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/profile/${userId}`);
        const profile = await response.json();
        
        if (profile && profile.name) {
            userProfile = profile; // Зберігаємо профіль
            showProfileConfirm(profile); // Показуємо екран підтвердження
        } else {
            showOrderForm(); // Профілю немає, показуємо пусту форму
        }
    } catch (e) {
        console.error("Помилка завантаження профілю:", e);
        tg.showAlert("Помилка завантаження профілю. Спробуйте ще раз.");
    }
}

// Крок 2 (Гілка A): Показати екран підтвердження
function showProfileConfirm(profile) {
    currentView = 'profile';
    profileDataDisplay.innerHTML = `
        <p><strong>ПІБ:</strong> ${profile.name}</p>
        <p><strong>Телефон:</strong> ${profile.phone}</p>
        <p><strong>Адреса:</strong> ${profile.address}</p>
    `;
    showScreen('profile');
}

// Крок 2 (Гілка B): Показати пусту форму
function showOrderForm() {
    currentView = 'order';
    // Автозаповнення імені, якщо воно є в Telegram
    const user = tg.initDataUnsafe?.user;
    if (user && !document.getElementById('name').value) {
        document.getElementById('name').value = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    showScreen('order');
}

// Крок 3 (Гілка A): Юзер тисне "Використати ці дані"
confirmUseProfileBtn.onclick = () => {
    const deliveryTime = deliveryTimeProfileInput.value || 'Якнайшвидше';
    const clientDetails = { ...userProfile, delivery_time: deliveryTime };
    submitOrder(clientDetails);
};

// Крок 3 (Гілка B): Юзер тисне "Ввести нові дані"
confirmNewDataBtn.onclick = showOrderForm;

// Крок 3 (Гілка C): Юзер заповнює пусту форму
orderForm.onsubmit = (e) => {
    e.preventDefault();
    const clientDetails = {
        telegram_id: tg.initDataUnsafe?.user?.id || null,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        delivery_time: document.getElementById('delivery_time').value || 'Якнайшвидше'
    };
    submitOrder(clientDetails);
};

// Крок 3 (Назад): Повернення з форми до кошика
backToCartBtn.onclick = () => {
    showScreen('app');
    currentView = 'cart';
    updateMainButton();
};

// Крок 4: Фінальна відправка замовлення (спільна для обох гілок)
async function submitOrder(clientDetails) {
    let totalPrice = 0;
    for (const productId in cart) {
        const product = productsCache[productId];
        const quantity = cart[productId];
        if (product) {
            totalPrice += product.price * quantity;
        }
    }
    
    const orderData = {
        cart: cart,
        client_details: clientDetails,
        total_price: totalPrice
    };

    try {
    // 1. Готуємо Головну Кнопку до відправки
    tg.MainButton.setText("Обробка...");
    tg.MainButton.showProgress(true);
    tg.MainButton.disable();

    // 2. **ГОЛОВНИЙ КРОК: Відправка даних боту**
    // Ця команда АСИНХРОННА. 
    // Ми НЕ будемо закривати вікно.
    tg.sendData(JSON.stringify(orderData));

    // 3. **НАДАЄМО ВІДГУК КОРИСТУВАЧУ ТУТ**
    // Ховаємо всі екрани
    showScreen('none'); 

    // Показуємо повідомлення про успіх
    appContainer.classList.remove('hidden');
    appContainer.innerHTML = `
        <h2>✅ Дякуємо!</h2>
        <p>Ваше замовлення успішно надіслано в обробку.</p>
        <p>Ви отримаєте підтвердження від бота в чаті за мить.</p>
        <p>Ви можете закрити цей екран.</p>
    `;

    // 4. Повідомляємо Telegram, що все добре,
    // і він може закрити вікно
    tg.HapticFeedback.notificationOccurred('success');

    // Через 3 секунди можна закрити TWA, 
    // щоб користувач побачив повідомлення від бота.
    setTimeout(() => tg.close(), 3000);

} catch (error) {
    console.error("Помилка відправки замовлення: ", error);
    tg.showAlert("Сталася помилка. Спробуйте ще раз.");

    // Повертаємо кнопку в робочий стан
    tg.MainButton.setText("Помилка! Спробувати ще раз");
    tg.MainButton.hideProgress(false);
    tg.MainButton.enable();
}
}

// --- 6. ДОПОМІЖНІ ФУНКЦІЇ ---

// Керує видимістю екранів
function showScreen(screenName) {
    appContainer.classList.add('hidden');
    orderFormContainer.classList.add('hidden');
    profileConfirmContainer.classList.add('hidden');
    tg.MainButton.hide();

    if (screenName === 'none') { // <-- ДОДАЙТЕ ЦЕЙ РЯДОК
        return; // Просто все ховаємо
    } else if (screenName === 'order') {
        orderFormContainer.classList.remove('hidden');
    } else if (screenName === 'profile') {
        profileConfirmContainer.classList.remove('hidden');
    }
}

function showLoader() {
    appContainer.innerHTML = '<div class="loader">Завантаження...</div>';
}

function showError(message) {
    appContainer.innerHTML = `<div class="error">${message}</div>`;
}


