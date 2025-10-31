// --- 1. НАЛАШТУВАННЯ ---

// URL вашого API, який ми налаштували на Nginx
const API_URL = "https://zhadkivski-shop.servegame.com";
// URL для статичних файлів (фото)
const STATIC_URL = `${API_URL}/static/`;

// Ініціалізуємо Telegram Web App
const tg = window.Telegram.WebApp;

// Отримуємо головні елементи зі сторінки
const appContainer = document.getElementById('app');
const orderFormContainer = document.getElementById('order-form-container');
const orderForm = document.getElementById('order-form');

// Глобальні змінні
let cart = {}; // Наш кошик { product_id: quantity }
let productsCache = {}; // Кеш товарів, щоб не завантажувати їх знову
let currentView = 'categories'; // Поточний екран ('categories', 'products', 'cart')

// --- 2. ГОЛОВНА ЛОГІКА (ЗАПУСК) ---

// Запускаємо головну функцію, коли TWA готовий
tg.ready();
loadCategories();

// Налаштовуємо Головну Кнопку Telegram
tg.MainButton.setText("🛒 Переглянути кошик");
tg.MainButton.onClick(showCartSummary);

// --- 3. ФУНКЦІЇ НАВІГАЦІЇ ТА ВІДОБРАЖЕННЯ ---

// Завантажує та показує категорії
async function loadCategories() {
    currentView = 'categories';
    showLoader();
    try {
        const response = await fetch(`${API_URL}/api/categories`);
        const categories = await response.json();
        
        appContainer.innerHTML = '<h2>Оберіть категорію:</h2>';
        const grid = document.createElement('div');
        grid.className = 'grid-container';

        categories.forEach(([id, name]) => {
            grid.innerHTML += `
                <div class="category-btn" onclick="loadProducts(${id})">
                    ${name}
                </div>
            `;
        });
        appContainer.appendChild(grid);
    } catch (e) {
        showError("Помилка завантаження категорій.");
        console.error(e);
    }
    updateMainButton();
}

// Завантажує та показує товари
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

        if (products.length === 0) {
            grid.innerHTML = "<p>В цій категорії товарів немає.</p>";
        }

        products.forEach(prod => {
            // Зберігаємо товар у кеш
            productsCache[prod.id] = prod; 
            
            const photoUrl = prod.photo_url ? `${STATIC_URL}${prod.photo_url}` : 'https://via.placeholder.com/150'; // Заглушка, якщо фото немає
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
                            ${!inStock ? 'Немає' : 'Додати в кошик'}
                        </button>
                    </div>
                </div>
            `;
        });
        appContainer.appendChild(grid);
    } catch (e) {
        showError("Помилка завантаження товарів.");
        console.error(e);
    }
    updateMainButton();
}

// --- 4. ЛОГІКА КОШИКА ---

// Додає товар у кошик
function addToCart(productId) {
    const product = productsCache[productId];
    if (!product) return;

    let quantityInCart = cart[productId] || 0;

    // Перевірка залишків
    if (quantityInCart >= product.stock) {
        tg.showAlert(`Вибачте, але на складі маємо всього ${product.stock} шт 😢`);
        return;
    }

    cart[productId] = quantityInCart + 1;
    
    // Повідомлення про додавання
    tg.HapticFeedback.notificationOccurred('success');
    
    // Оновлюємо кнопку
    const btn = document.getElementById(`btn-prod-${productId}`);
    if (btn) {
        btn.innerText = `У кошику: ${cart[productId]}`;
    }
    
    updateMainButton();
}

// Оновлює вигляд та текст Головної Кнопки
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

// Показує вміст кошика (нова "сторінка")
function showCartSummary() {
    if (Object.keys(cart).length === 0) {
        tg.showAlert("Ваш кошик порожній.");
        return;
    }

    // Якщо ми не на сторінці кошика, показуємо кошик
    // Якщо ми ВЖЕ на сторінці кошика, показуємо форму замовлення
    if (currentView !== 'cart') {
        currentView = 'cart';
        showLoader();
        appContainer.innerHTML = '<h2>🛒 Ваш кошик:</h2>';
        
        let totalPrice = 0;
        const cartItemsContainer = document.createElement('div');
        
        for (const productId in cart) {
            const product = productsCache[productId];
            const quantity = cart[productId];
            if (!product) continue; // Товар не знайдено в кеші
            
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
        
        // Кнопка "Назад"
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        backBtn.innerText = '⬅️ Назад до товарів';
        backBtn.onclick = () => {
             // Повертаємось до категорій, бо не знаємо, з якої саме категорії прийшов юзер
            loadCategories();
        };
        appContainer.prepend(backBtn);
        
        updateMainButton();
    } else {
        // Ми ВЖЕ в кошику, і юзер тисне "Перейти до оформлення"
        showOrderForm();
    }
}

// Видаляє товар з кошика (спрощено, можна додати +-)
function removeFromCart(productId) {
    if (cart[productId]) {
        delete cart[productId];
        tg.HapticFeedback.notificationOccurred('warning');
        showCartSummary(); // Оновити вигляд кошика
    }
}

// --- 5. ЛОГІКА ОФОРМЛЕННЯ ЗАМОВЛЕННЯ ---

// Показує форму оформлення
function showOrderForm() {
    currentView = 'order';
    appContainer.classList.add('hidden'); // Ховаємо каталог
    orderFormContainer.classList.remove('hidden'); // Показуємо форму
    tg.MainButton.hide(); // Ховаємо головну кнопку, поки юзер заповнює форму

    // Спробуємо автозаповнити дані з Telegram
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('name').value = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
}

// Обробник натискання кнопки "Назад" у формі
document.getElementById('back-to-cart-btn').onclick = () => {
    orderFormContainer.classList.add('hidden'); // Ховаємо форму
    appContainer.classList.remove('hidden'); // Показуємо кошик
    currentView = 'cart';
    updateMainButton();
};

// Обробник відправки форми
orderForm.onsubmit = async (e) => {
    e.preventDefault(); // Забороняємо стандартну відправку форми
    
    // Збираємо дані замовлення
    let totalPrice = 0;
    for (const productId in cart) {
        const product = productsCache[productId];
        const quantity = cart[productId];
        if (product) {
            totalPrice += product.price * quantity;
        }
    }
    
    const clientDetails = {
        telegram_id: tg.initDataUnsafe?.user?.id || null,
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        delivery_time: document.getElementById('delivery_time').value || 'Якнайшвидше'
    };
    
    const orderData = {
        cart: cart,
        client_details: clientDetails,
        total_price: totalPrice
    };

    try {
        // Готуємо Головну Кнопку до відправки
        tg.MainButton.setText("Обробка...");
        tg.MainButton.showProgress(true);
        tg.MainButton.disable();

        // **ГОЛОВНИЙ КРОК: Відправка даних боту**
        // Ваш backend (`web_app_data_handler`) отримає цей JSON
        tg.sendData(JSON.stringify(orderData));

        // tg.sendData() не дає відповіді, успіх чи ні.
        // Бот має відповісти юзеру повідомленням.
        // Ми просто закриваємо TWA після відправки.
        
        // tg.close() буде викликано після того, як бот отримає дані
        // (Але для надійності закриємо через 1 сек, якщо sendData не закриє)
        setTimeout(() => tg.close(), 1000);

    } catch (error) {
        console.error("Помилка відправки замовлення: ", error);
        tg.showAlert("Сталася помилка. Спробуйте ще раз.");
        // Повертаємо кнопку в робочий стан
        tg.MainButton.setText("Помилка! Спробувати ще раз");
        tg.MainButton.hideProgress(false);
        tg.MainButton.enable();
    }
};


// --- 6. ДОПОМІЖНІ ФУНКЦІЇ ---

function showLoader() {
    appContainer.innerHTML = '<div class="loader">Завантаження...</div>';
}

function showError(message) {
    appContainer.innerHTML = `<div class="error">${message}</div>`;
}