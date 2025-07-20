// Configuración de la API - JSONP (Sin CORS)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxjDBj9g6V79uY4qsgNF6S-wgV6a0ah0zyLbL-wAv3H8_u8q0QEZB4KQKNgCM8yF8Le/exec';

let currentUser = null;
let productsData = {
    profiles: [],
    accounts: [],
    license: []
};
let requestCounter = 0;
let currentProductType = 'profiles';
let currentServiceType = 'profiles';
let autoRefreshInterval = null;

// Función JSONP para evitar CORS
function jsonpRequest(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + (++requestCounter);
        const script = document.createElement('script');
        
        // Crear callback global
        window[callbackName] = function(data) {
            document.body.removeChild(script);
            delete window[callbackName];
            resolve(data);
        };
        
        // Construir URL con parámetros
        const urlParams = new URLSearchParams({
            action: action,
            callback: callbackName,
            ...params
        });
        
        script.src = `${API_BASE_URL}?${urlParams.toString()}`;
        script.onerror = () => {
            document.body.removeChild(script);
            delete window[callbackName];
            reject(new Error('Error de red'));
        };
        
        // Timeout
        setTimeout(() => {
            if (window[callbackName]) {
                document.body.removeChild(script);
                delete window[callbackName];
                reject(new Error('Timeout'));
            }
        }, 30000);
        
        document.body.appendChild(script);
    });
}

// Función auxiliar para hacer peticiones a la API
async function apiRequest(action, data = {}) {
    try {
        const result = await jsonpRequest(action, data);
        return result;
    } catch (error) {
        console.error('Error en API:', error);
        throw new Error(error.message || 'Error de conexión');
    }
}

// Funciones de SweetAlert
function showSuccessAlert(title, text = '') {
    return Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
    });
}

function showErrorAlert(title, text = '') {
    return Swal.fire({
        icon: 'error',
        title: 'Error',
        text: title + (text ? ': ' + text : ''),
        confirmButtonText: 'Entendido'
    });
}

function showLoadingAlert(title = 'Procesando...') {
    return Swal.fire({
        title: title,
        html: 'Por favor espera...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function showConfirmAlert(title, text, confirmText = 'Sí, continuar') {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    });
}

// Funciones de navegación principal
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelectorAll('#auth-section .nav-link')[0].classList.add('active');
    document.querySelectorAll('#auth-section .nav-link')[1].classList.remove('active');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.querySelectorAll('#auth-section .nav-link')[0].classList.remove('active');
    document.querySelectorAll('#auth-section .nav-link')[1].classList.add('active');
}

function showProducts() {
    document.getElementById('products-section').classList.remove('hidden');
    document.getElementById('wallet-section').classList.add('hidden');
    document.getElementById('my-items-section').classList.add('hidden');
    updateNavLinks(0);
    
    // YA NO ES NECESARIO: Los productos ya están cargados
    // Solo mostrar el tipo actual
    showProductType(currentProductType);
}

function showWallet() {
    document.getElementById('products-section').classList.add('hidden');
    document.getElementById('wallet-section').classList.remove('hidden');
    document.getElementById('my-items-section').classList.add('hidden');
    updateNavLinks(1);
}

function showMyItems() {
    document.getElementById('products-section').classList.add('hidden');
    document.getElementById('wallet-section').classList.add('hidden');
    document.getElementById('my-items-section').classList.remove('hidden');
    updateNavLinks(2);
    
    // YA NO ES NECESARIO: Los servicios ya están cargados
    // Solo mostrar el tipo actual
    showServiceType(currentServiceType);
}

function updateNavLinks(activeIndex) {
    const navLinks = document.querySelectorAll('#main-section .nav-link');
    navLinks.forEach((link, index) => {
        if (index === activeIndex) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// NUEVAS FUNCIONES: Manejo de tabs de productos
function showProductType(productType) {
    currentProductType = productType;
    
    // Actualizar tabs activos
    document.querySelectorAll('.product-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.product-tab[onclick="showProductType('${productType}')"]`).classList.add('active');
    
    // Mostrar contenido correspondiente
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${productType}-tab`).classList.add('active');
    
    // YA NO ES NECESARIO: Los productos ya están cargados
    // Los datos ya están en productsData[productType]
}

// NUEVAS FUNCIONES: Manejo de tabs de servicios de usuario
function showServiceType(serviceType) {
    currentServiceType = serviceType;
    
    // Actualizar tabs activos
    document.querySelectorAll('.service-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.service-tab[onclick="showServiceType('${serviceType}')"]`).classList.add('active');
    
    // Mostrar contenido correspondiente
    document.querySelectorAll('.service-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`user-${serviceType}-tab`).classList.add('active');
    
    // YA NO ES NECESARIO: Los servicios ya están cargados
    // Los datos ya están renderizados
}

function setButtonsDisabled(disabled) {
    document.querySelectorAll('.btn').forEach(button => button.disabled = disabled);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccessAlert('¡Copiado!', 'La información se ha copiado al portapapeles');
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showSuccessAlert('¡Copiado!', 'La información se ha copiado al portapapeles');
    } catch (err) {
        showErrorAlert('No se pudo copiar', 'Por favor copia manualmente la información');
    }
    document.body.removeChild(textArea);
}

// Función para copiar contenido al portapapeles
function copyContentToClipboard(content) {
    copyToClipboard(content);
}

// Funciones de autenticación
async function register() {
    const whatsapp = document.getElementById('register-whatsapp').value;
    const password = document.getElementById('register-password').value;

    if (!whatsapp || !password) {
        showErrorAlert('Por favor completa todos los campos');
        return;
    }

    showLoadingAlert('Registrando usuario...');
    setButtonsDisabled(true);

    try {
        const result = await apiRequest('register', { whatsapp, password });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            showSuccessAlert('¡Registro exitoso!', 'Por favor inicia sesión con tus credenciales');
            showLogin();
            document.getElementById('register-whatsapp').value = '';
            document.getElementById('register-password').value = '';
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

async function login() {
    const whatsapp = document.getElementById('login-whatsapp').value;
    const password = document.getElementById('login-password').value;

    if (!whatsapp || !password) {
        showErrorAlert('Por favor completa todos los campos');
        return;
    }

    showLoadingAlert('Iniciando sesión...');
    setButtonsDisabled(true);

    try {
        const result = await apiRequest('login', { whatsapp, password });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            currentUser = result.data;
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-section').classList.remove('hidden');
            
            // Mostrar indicador de rol si es distribuidor
            updateUserInterface();
            
            // NUEVO: Cargar todos los datos al inicio
            await loadInitialData();
            
            // NUEVO: Iniciar auto-actualización
            startAutoRefresh();
            
            // Mensaje de bienvenida personalizado según rol
            const welcomeMessage = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' 
                ? '¡Bienvenido Distribuidor!' 
                : '¡Bienvenido!';
            
            showSuccessAlert(welcomeMessage);
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// Función para actualizar la interfaz según el rol del usuario
function updateUserInterface() {
    const header = document.querySelector('.header h1');
    if (currentUser && currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor') {
        header.textContent = 'Mi Store - Distribuidor';
        header.style.color = '#ffd700'; // Color dorado para distribuidores
    } else {
        header.textContent = 'Mi Store';
        header.style.color = 'white';
    }
}

function logout() {
    currentUser = null;
    productsData = {
        profiles: [],
        accounts: [],
        license: []
    };
    currentProductType = 'profiles';
    currentServiceType = 'profiles';
    
    // NUEVO: Detener auto-actualización
    stopAutoRefresh();
    
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('main-section').classList.add('hidden');
    document.getElementById('login-whatsapp').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-whatsapp').value = '';
    document.getElementById('register-password').value = '';
    
    // Restaurar header original
    const header = document.querySelector('.header h1');
    header.textContent = 'Mi Store';
    header.style.color = 'white';
    
    showLogin();
    showSuccessAlert('Sesión cerrada correctamente');
}

// Funciones de balance y productos
async function updateBalance() {
    try {
        const result = await apiRequest('getBalance', { userId: currentUser.userId });
        if (result.success) {
            document.getElementById('balance').textContent = result.data.balance.toFixed(2);
            currentUser.balance = result.data.balance;
        }
    } catch (error) {
        console.error('Error actualizando balance:', error);
    }
}

// NUEVA FUNCIÓN: Cargar todos los tipos de productos
async function loadAllProductTypes() {
    const types = ['profiles', 'accounts', 'license'];
    
    for (const type of types) {
        await loadProductsByType(type);
    }
}

// NUEVA FUNCIÓN: Cargar productos por tipo específico
async function loadProductsByType(productType) {
    try {
        const grid = document.getElementById(`${productType}-grid`);
        grid.innerHTML = '<div class="loading">Cargando...</div>';
        
        const result = await apiRequest('getProducts', { 
            userId: currentUser.userId, 
            productType: productType 
        });
        
        grid.innerHTML = '';

        if (result.success && result.data && result.data.length > 0) {
            productsData[productType] = result.data;
            
            // Actualizar contador en el tab
            updateProductTabCount(productType, result.data.length);
            
            // Mostrar indicador de precios según rol
            if (productType === currentProductType) {
                const priceIndicator = document.createElement('div');
                priceIndicator.className = 'price-indicator';
                if (currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor') {
                    priceIndicator.innerHTML = '<span class="distributor-badge">📊 Precios de Distribuidor</span>';
                } else {
                    priceIndicator.innerHTML = '<span class="regular-badge">💰 Precios Regulares</span>';
                }
                grid.appendChild(priceIndicator);
            }
            
            result.data.forEach(product => {
                const productCard = createProductCard(product);
                grid.appendChild(productCard);
            });
        } else {
            updateProductTabCount(productType, 0);
            grid.innerHTML = `<div class="loading">No hay ${getProductTypeLabel(productType)} disponibles</div>`;
        }
    } catch (error) {
        console.error(`Error cargando productos ${productType}:`, error);
        document.getElementById(`${productType}-grid`).innerHTML = 
            `<div class="loading">Error cargando ${getProductTypeLabel(productType)}</div>`;
        updateProductTabCount(productType, 0);
    }
}

// NUEVA FUNCIÓN: Actualizar contador de tabs de productos
function updateProductTabCount(productType, count) {
    const countElement = document.getElementById(`${productType}-count`);
    if (countElement) {
        countElement.textContent = count;
        countElement.style.display = count > 0 ? 'flex' : 'none';
    }
}

// NUEVA FUNCIÓN: Obtener etiqueta legible del tipo de producto
function getProductTypeLabel(productType) {
    const labels = {
        'profiles': 'perfiles',
        'accounts': 'cuentas',
        'license': 'licencias'
    };
    return labels[productType] || productType;
}

// NUEVA FUNCIÓN: Crear tarjeta de producto
function createProductCard(product) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    
    let productHTML = `<div class="product-name">${product.name}</div>`;
    
    // Crear selector dinámico basado en precios disponibles
    let durationOptions = '';
    let defaultPrice = 0;
    let defaultDuration = 1;
    
    // Verificar cada precio de 1 a 12 meses
    for (let month = 1; month <= 12; month++) {
        const priceProperty = `price${month}Month${month > 1 ? 's' : ''}`;
        const price = product[priceProperty];
        
        if (price && price > 0) {
            const monthLabel = month === 1 ? '1 Mes' : `${month} Meses`;
            durationOptions += `<option value="${month}">${monthLabel} - $${price.toFixed(2)}</option>`;
            
            if (defaultPrice === 0) {
                defaultPrice = price;
                defaultDuration = month;
            }
        }
    }
    
    // Solo mostrar selector si hay al menos una opción disponible
    if (durationOptions) {
        if (product.productType === 'license') {
            // Para licencias, mostrar precio simple
            productHTML += `
                <div class="product-price">$${defaultPrice.toFixed(2)}</div>
                <button class="btn" onclick="buyProduct('${product.id}')">Comprar</button>
            `;
        } else {
            // Para productos con duración variable
            productHTML += `
                <div class="duration-selector">
                    <label for="duration-${product.id}">Duración:</label>
                    <select id="duration-${product.id}" onchange="updateProductPrice('${product.id}', this)">
                        ${durationOptions}
                    </select>
                    <div class="duration-info">El precio se actualiza según la duración seleccionada</div>
                </div>
                <div class="product-price">$${defaultPrice.toFixed(2)}</div>
                <button class="btn" onclick="buyProduct('${product.id}')">Comprar</button>
            `;
        }
    } else {
        // Si no hay precios disponibles, mostrar producto no disponible
        productHTML += `
            <div class="product-price">No disponible</div>
            <button class="btn" disabled>No disponible</button>
        `;
    }
    
    productCard.innerHTML = productHTML;
    return productCard;
}

// Función para actualizar precio del producto
function updateProductPrice(productId, selectElement) {
    const selectedDuration = parseInt(selectElement.value);
    
    // Buscar producto en todos los tipos
    let product = null;
    for (const type in productsData) {
        product = productsData[type].find(p => p.id === productId);
        if (product) break;
    }
    
    if (product) {
        const priceProperty = `price${selectedDuration}Month${selectedDuration > 1 ? 's' : ''}`;
        const price = product[priceProperty] || 0;
        
        if (price > 0) {
            const priceElement = selectElement.closest('.product-card').querySelector('.product-price');
            priceElement.textContent = `$${price.toFixed(2)}`;
        }
    }
}

// Función para comprar producto
async function buyProduct(productId) {
    if (!currentUser) {
        showErrorAlert('Error: Usuario no válido');
        return;
    }
    
    // Buscar producto en todos los tipos
    let product = null;
    for (const type in productsData) {
        product = productsData[type].find(p => p.id === productId);
        if (product) break;
    }
    
    if (!product) {
        showErrorAlert('Error: Producto no encontrado');
        return;
    }
    
    let duration = 1; // Por defecto 1 mes
    let selectedPrice = 0;
    
    // Si el producto no es licencia, obtener la duración seleccionada
    if (product.productType !== 'license') {
        const durationSelect = document.getElementById(`duration-${productId}`);
        if (durationSelect) {
            duration = parseInt(durationSelect.value);
        }
    }
    
    // Obtener precio según duración
    const priceProperty = `price${duration}Month${duration > 1 ? 's' : ''}`;
    selectedPrice = product[priceProperty] || 0;
    
    // Validar que el precio sea válido
    if (selectedPrice <= 0) {
        showErrorAlert('Error: Precio no válido para esta duración');
        return;
    }
    
    // Verificar saldo antes de proceder
    if (currentUser.balance < selectedPrice) {
        showErrorAlert('Saldo insuficiente para realizar esta compra');
        return;
    }

    // Confirmar compra con precio mostrado
    const rolText = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' ? ' (Precio Distribuidor)' : '';
    const durationText = product.productType === 'license' ? '' : 
        ` (${duration} ${duration === 1 ? 'mes' : 'meses'})`;
    
    const confirmResult = await showConfirmAlert(
        '¿Confirmar compra?',
        `¿Quieres comprar "${product.name}" por $${selectedPrice.toFixed(2)}${durationText}${rolText}?`,
        'Sí, comprar'
    );

    if (!confirmResult.isConfirmed) {
        return;
    }
    
    showLoadingAlert('Procesando compra...');
    setButtonsDisabled(true);

    try {
        const result = await apiRequest('createOrder', { 
            userId: currentUser.userId, 
            productId: productId, 
            duration: duration 
        });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            // 1. Primer mensaje: Compra exitosa (3 segundos con auto-close)
            showSuccessAlert('¡Compra realizada exitosamente!', 'Actualizando tus servicios...');
            
            // Actualizar datos inmediatamente (en paralelo)
            const updatePromise = refreshAfterPurchase();
            
            // 2. Segundo mensaje: aparece cuando se cierra el primero (después de 3 segundos)
            setTimeout(() => {
                // Crear SweetAlert personalizado con 7 segundos
                Swal.fire({
                    icon: 'success',
                    title: '¡Preparando tu servicio!',
                    text: 'Ya casi serás redirigido',
                    timer: 7000, // 7 segundos
                    timerProgressBar: true,
                    showConfirmButton: false
                });
                
                // 3. Programar redirección para cuando se cierre el segundo mensaje
                setTimeout(async () => {
                    // Asegurar que los datos estén listos antes de redirigir
                    await updatePromise;
                    
                    showMyItems();
                    // Mostrar el tipo correcto según el producto comprado
                    if (result.data.productType === 'accounts') {
                        showServiceType('accounts');
                    } else {
                        showServiceType('profiles');
                    }
                    
                    // 4. Mensaje final: Inmediato después de redirección
                    showSuccessAlert('¡Listo!', 'Tu nuevo servicio ya está disponible');
                }, 7000);
                
            }, 3000); // 3 segundos para que se cierre el primer mensaje
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// Función para agregar fondos (solo informativa)
function addFunds() {
    showErrorAlert('Funcionalidad no disponible', 'Los fondos deben ser agregados manualmente por el administrador después de verificar el pago por Sinpe Móvil.');
}

// Función para redimir Gift Card
async function redeemGiftcard() {
    const giftcardCode = document.getElementById('giftcard-code').value.trim();
    
    if (!giftcardCode) {
        showErrorAlert('Por favor ingresa un código de cupón válido');
        return;
    }
    
    if (!currentUser) {
        showErrorAlert('Error: Usuario no válido');
        return;
    }

    showLoadingAlert('Canjeando cupón...');
    setButtonsDisabled(true);

    try {
        const result = await apiRequest('redeemGiftcard', { 
            giftcardCode: giftcardCode,
            userWhatsApp: currentUser.whatsapp
        });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            // Limpiar el campo de input
            document.getElementById('giftcard-code').value = '';
            
            showSuccessAlert(
                '¡Cupón canjeado exitosamente!', 
                `Se agregaron ${result.data.amount.toFixed(2)} a tu cuenta`
            );
            await refreshAfterPurchase();
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// NUEVA FUNCIÓN: Cargar todos los servicios del usuario
async function loadAllUserServices() {
    await loadUserProfiles();
    await loadUserAccounts();
}

// Función para cargar perfiles de usuario
async function loadUserProfiles() {
    if (!currentUser) {
        return;
    }

    const profilesList = document.getElementById('user-profiles-list');
    profilesList.innerHTML = '<div class="loading">Cargando perfiles...</div>';

    try {
        const result = await apiRequest('getUserProfiles', { userWhatsApp: currentUser.whatsapp });
        
        profilesList.innerHTML = '';
        
        if (result.success && result.data.length > 0) {
            // Actualizar contador
            updateServiceTabCount('profiles', result.data.length);
            
            // Ordenar perfiles por fecha de inicio (más reciente primero)
            const sortedProfiles = result.data.sort((a, b) => {
                return new Date(b.fechaInicio) - new Date(a.fechaInicio);
            });
            
            sortedProfiles.forEach(profile => {
                const profileCard = createProfileCard(profile);
                profilesList.appendChild(profileCard);
            });
        } else {
            updateServiceTabCount('profiles', 0);
            profilesList.innerHTML = `
                <div class="no-profiles">
                    <h3>No tienes perfiles activos</h3>
                    <p>Compra un producto que use perfiles para obtener tu primer perfil</p>
                </div>
            `;
        }
    } catch (error) {
        updateServiceTabCount('profiles', 0);
        profilesList.innerHTML = '<div class="loading">Error cargando perfiles</div>';
        showErrorAlert('Error cargando perfiles', error.message);
    }
}

// NUEVA FUNCIÓN: Cargar cuentas de usuario
async function loadUserAccounts() {
    if (!currentUser) {
        return;
    }

    const accountsList = document.getElementById('user-accounts-list');
    accountsList.innerHTML = '<div class="loading">Cargando cuentas...</div>';

    try {
        const result = await apiRequest('getUserAccounts', { userWhatsApp: currentUser.whatsapp });
        
        accountsList.innerHTML = '';
        
        if (result.success && result.data.length > 0) {
            // Actualizar contador
            updateServiceTabCount('accounts', result.data.length);
            
            // Ordenar cuentas por fecha de inicio (más reciente primero)
            const sortedAccounts = result.data.sort((a, b) => {
                return new Date(b.fechaInicio) - new Date(a.fechaInicio);
            });
            
            sortedAccounts.forEach(account => {
                const accountCard = createAccountCard(account);
                accountsList.appendChild(accountCard);
            });
        } else {
            updateServiceTabCount('accounts', 0);
            accountsList.innerHTML = `
                <div class="no-accounts">
                    <h3>No tienes cuentas activas</h3>
                    <p>Compra un producto que use cuentas para obtener tu primera cuenta</p>
                </div>
            `;
        }
    } catch (error) {
        updateServiceTabCount('accounts', 0);
        accountsList.innerHTML = '<div class="loading">Error cargando cuentas</div>';
        showErrorAlert('Error cargando cuentas', error.message);
    }
}

// NUEVA FUNCIÓN: Actualizar contador de tabs de servicios
function updateServiceTabCount(serviceType, count) {
    const countElement = document.getElementById(`user-${serviceType}-count`);
    if (countElement) {
        countElement.textContent = count;
        countElement.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Función para crear tarjeta de perfil
function createProfileCard(profile) {
    const profileCard = document.createElement('div');
    
    // Calcular estado y días restantes
    const today = new Date();
    const endDate = new Date(profile.fechaFinal);
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    let statusClass = 'active';
    let statusText = 'Activo';
    let statusBadgeClass = 'status-active';
    let daysClass = 'good';
    
    if (daysRemaining < 0) {
        statusClass = 'expired';
        statusText = 'Vencido';
        statusBadgeClass = 'status-expired';
        daysClass = 'critical';
    } else if (daysRemaining <= 7) {
        statusBadgeClass = 'status-expiring';
        statusText = 'Por vencer';
        daysClass = 'critical';
    } else if (daysRemaining <= 15) {
        daysClass = 'warning';
    }
    
    profileCard.className = `profile-card ${statusClass}`;
    
    // Obtener precios dinámicos para la renovación según rol del usuario
    const platformProduct = findProductByNameAndType(profile.plataforma, 'profiles');
    let renewalOptions = '';
    
    if (platformProduct) {
        // Crear opciones de renovación solo para precios disponibles (1-12 meses)
        for (let month = 1; month <= 12; month++) {
            const priceProperty = `price${month}Month${month > 1 ? 's' : ''}`;
            const price = platformProduct[priceProperty];
            
            if (price && price > 0) {
                const monthLabel = month === 1 ? '1 Mes' : `${month} Meses`;
                const roleIndicator = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' ? ' (Dist.)' : '';
                renewalOptions += `<option value="${month}">${monthLabel} - $${price.toFixed(2)}${roleIndicator}</option>`;
            }
        }
    }
    
    // Si no hay opciones de renovación disponibles, usar valores por defecto
    if (!renewalOptions) {
        renewalOptions = `<option value="1">1 Mes - No disponible</option>`;
    }
    
    // Escapar caracteres especiales para evitar problemas en el onclick
    const escapedResumen = profile.resumen.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    profileCard.innerHTML = `
        <div class="profile-header">
            <div class="profile-name">${profile.plataforma} - ${profile.perfil}</div>
            <div class="profile-status ${statusBadgeClass}">${statusText}</div>
        </div>
        
        <div class="profile-details">
             ${profile.resumen.replaceAll("\n","<br>")}
        </div>
        
        <div class="profile-dates">
            <div class="date-item">
                <span class="date-label">Fecha Inicio</span>
                <span class="date-value">${new Date(profile.fechaInicio).toLocaleDateString('es-ES')}</span>
            </div>
            <div class="date-item">
                <span class="date-label">Fecha Vencimiento</span>
                <span class="date-value">${new Date(profile.fechaFinal).toLocaleDateString('es-ES')}</span>
            </div>
        </div>
        
        <div class="profile-dates">
            <div class="date-item">
                <span class="date-label">Días restantes</span>
                <span class="date-value days-remaining ${daysClass}">${daysRemaining > 0 ? daysRemaining : 0}</span>
            </div>
            <div class="date-item">
                <span class="date-label">ID Perfil</span>
                <span class="date-value">${profile.idPerfil}</span>
            </div>
        </div>
        
        <div class="copy-section">
            <button class="btn btn-copy" onclick="copyContentToClipboard('${escapedResumen}')">
                📋 Copiar Perfil
            </button>
        </div>
        
        <div class="renewal-section">
            <div class="renewal-options">
                <div class="form-group">
                    <label for="renewal-duration-${profile.idPerfil}">Renovar por:</label>
                    <select id="renewal-duration-${profile.idPerfil}">
                        ${renewalOptions}
                    </select>
                    <div class="renewal-info">
                        ${daysRemaining > 0 ? 'Se sumará al tiempo restante' : 'Se activará desde hoy'}
                    </div>
                </div>
                <button class="btn btn-renew" onclick="renewProfile('${profile.idPerfil}')">
                    💳 Renovar
                </button>
            </div>
        </div>
    `;
    
    return profileCard;
}

// NUEVA FUNCIÓN: Crear tarjeta de cuenta
function createAccountCard(account) {
    const accountCard = document.createElement('div');
    
    // Calcular estado y días restantes
    const today = new Date();
    const endDate = new Date(account.fechaFinal);
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    let statusClass = 'active';
    let statusText = 'Activo';
    let statusBadgeClass = 'status-active';
    let daysClass = 'good';
    
    if (daysRemaining < 0) {
        statusClass = 'expired';
        statusText = 'Vencido';
        statusBadgeClass = 'status-expired';
        daysClass = 'critical';
    } else if (daysRemaining <= 7) {
        statusBadgeClass = 'status-expiring';
        statusText = 'Por vencer';
        daysClass = 'critical';
    } else if (daysRemaining <= 15) {
        daysClass = 'warning';
    }
    
    accountCard.className = `account-card ${statusClass}`;
    
    // Obtener precios dinámicos para la renovación según rol del usuario
    const platformProduct = findProductByNameAndType(account.plataforma, 'accounts');
    let renewalOptions = '';
    
    if (platformProduct) {
        // Crear opciones de renovación solo para precios disponibles (1-12 meses)
        for (let month = 1; month <= 12; month++) {
            const priceProperty = `price${month}Month${month > 1 ? 's' : ''}`;
            const price = platformProduct[priceProperty];
            
            if (price && price > 0) {
                const monthLabel = month === 1 ? '1 Mes' : `${month} Meses`;
                const roleIndicator = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' ? ' (Dist.)' : '';
                renewalOptions += `<option value="${month}">${monthLabel} - ${price.toFixed(2)}${roleIndicator}</option>`;
            }
        }
    }
    
    // Si no hay opciones de renovación disponibles, usar valores por defecto
    if (!renewalOptions) {
        renewalOptions = `<option value="1">1 Mes - No disponible</option>`;
    }
    
    // Escapar caracteres especiales para evitar problemas en el onclick
    const escapedResumen = account.resumen.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    accountCard.innerHTML = `
        <div class="account-header">
            <div class="account-name">${account.plataforma} - Cuenta ${account.cuenta}</div>
            <div class="account-status ${statusBadgeClass}">${statusText}</div>
        </div>
        
        <div class="account-details">
             ${account.resumen.replaceAll("\n","<br>")}
        </div>
        
        <div class="account-dates">
            <div class="date-item">
                <span class="date-label">Fecha Inicio</span>
                <span class="date-value">${new Date(account.fechaInicio).toLocaleDateString('es-ES')}</span>
            </div>
            <div class="date-item">
                <span class="date-label">Fecha Vencimiento</span>
                <span class="date-value">${new Date(account.fechaFinal).toLocaleDateString('es-ES')}</span>
            </div>
        </div>
        
        <div class="account-dates">
            <div class="date-item">
                <span class="date-label">Días restantes</span>
                <span class="date-value days-remaining ${daysClass}">${daysRemaining > 0 ? daysRemaining : 0}</span>
            </div>
            <div class="date-item">
                <span class="date-label">ID Cuenta</span>
                <span class="date-value">${account.idCuenta}</span>
            </div>
        </div>
        
        <div class="copy-section">
            <button class="btn btn-copy" onclick="copyContentToClipboard('${escapedResumen}')">
                📋 Copiar Cuenta
            </button>
        </div>
        
        <div class="renewal-section">
            <div class="renewal-options">
                <div class="form-group">
                    <label for="renewal-account-duration-${account.idCuenta}">Renovar por:</label>
                    <select id="renewal-account-duration-${account.idCuenta}">
                        ${renewalOptions}
                    </select>
                    <div class="renewal-info">
                        ${daysRemaining > 0 ? 'Se sumará al tiempo restante' : 'Se activará desde hoy'}
                    </div>
                </div>
                <button class="btn btn-renew" onclick="renewAccount('${account.idCuenta}')">
                    💳 Renovar
                </button>
            </div>
        </div>
    `;
    
    return accountCard;
}

// NUEVA FUNCIÓN: Buscar producto por nombre y tipo
function findProductByNameAndType(productName, productType) {
    if (productsData[productType]) {
        return productsData[productType].find(product => product.name === productName);
    }
    return null;
}

// Función para renovar perfil
async function renewProfile(profileId) {
    if (!currentUser) {
        showErrorAlert('Error: Usuario no válido');
        return;
    }
    
    const durationSelect = document.getElementById(`renewal-duration-${profileId}`);
    if (!durationSelect) {
        showErrorAlert('Error: No se pudo obtener la duración seleccionada');
        return;
    }
    
    const duration = parseInt(durationSelect.value);
    const selectedOption = durationSelect.options[durationSelect.selectedIndex];
    
    // Extraer el precio del texto de la opción de manera más robusta
    let price = 0;
    try {
        const priceText = selectedOption.text.split(' - ')[1];
        // Remover indicadores de rol y extraer solo el precio
        const cleanPriceText = priceText.replace(/\s*\(Dist\.\)/, '').replace(/\$/g, '');
        price = parseFloat(cleanPriceText);
        
        // Verificar que el precio es válido
        if (isNaN(price) || price <= 0) {
            throw new Error('Precio inválido');
        }
    } catch (error) {
        showErrorAlert('Error: No se pudo obtener el precio del producto');
        return;
    }
    
    // Verificar saldo
    if (currentUser.balance < price) {
        showErrorAlert('Saldo insuficiente para renovar este perfil');
        return;
    }
    
    // Confirmar renovación con indicador de rol
    const monthLabel = duration === 1 ? 'mes' : 'meses';
    const roleIndicator = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' ? ' (Precio Distribuidor)' : '';
    const confirmResult = await showConfirmAlert(
        '¿Confirmar renovación?',
        `¿Confirmas la renovación por ${duration} ${monthLabel} por ${price.toFixed(2)}${roleIndicator}?`,
        'Sí, renovar'
    );
    
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    showLoadingAlert('Procesando renovación...');
    setButtonsDisabled(true);
    
    try {
        const result = await apiRequest('renewProfile', { 
            userWhatsApp: currentUser.whatsapp, 
            profileId: profileId, 
            durationMonths: duration 
        });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            // Primero actualizar datos
            await refreshAfterPurchase();
            
            showSuccessAlert('¡Perfil renovado exitosamente!', `Tu perfil ha sido renovado por ${duration} ${monthLabel}`);
            
            // Ya no es necesario loadUserProfiles() porque refreshAfterPurchase() ya lo hace
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// NUEVA FUNCIÓN: Renovar cuenta
async function renewAccount(accountId) {
    if (!currentUser) {
        showErrorAlert('Error: Usuario no válido');
        return;
    }
    
    const durationSelect = document.getElementById(`renewal-account-duration-${accountId}`);
    if (!durationSelect) {
        showErrorAlert('Error: No se pudo obtener la duración seleccionada');
        return;
    }
    
    const duration = parseInt(durationSelect.value);
    const selectedOption = durationSelect.options[durationSelect.selectedIndex];
    
    // Extraer el precio del texto de la opción de manera más robusta
    let price = 0;
    try {
        const priceText = selectedOption.text.split(' - ')[1];
        // Remover indicadores de rol y extraer solo el precio
        const cleanPriceText = priceText.replace(/\s*\(Dist\.\)/, '').replace(/\$/g, '');
        price = parseFloat(cleanPriceText);
        
        // Verificar que el precio es válido
        if (isNaN(price) || price <= 0) {
            throw new Error('Precio inválido');
        }
    } catch (error) {
        showErrorAlert('Error: No se pudo obtener el precio del producto');
        return;
    }
    
    // Verificar saldo
    if (currentUser.balance < price) {
        showErrorAlert('Saldo insuficiente para renovar esta cuenta');
        return;
    }
    
    // Confirmar renovación con indicador de rol
    const monthLabel = duration === 1 ? 'mes' : 'meses';
    const roleIndicator = currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor' ? ' (Precio Distribuidor)' : '';
    const confirmResult = await showConfirmAlert(
        '¿Confirmar renovación?',
        `¿Confirmas la renovación por ${duration} ${monthLabel} por ${price.toFixed(2)}${roleIndicator}?`,
        'Sí, renovar'
    );
    
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    showLoadingAlert('Procesando renovación...');
    setButtonsDisabled(true);
    
    try {
        const result = await apiRequest('renewAccount', { 
            userWhatsApp: currentUser.whatsapp, 
            accountId: accountId, 
            durationMonths: duration 
        });
        
        Swal.close();
        setButtonsDisabled(false);

        if (result.success) {
            // Primero actualizar datos
            await refreshAfterPurchase();
            
            showSuccessAlert('¡Cuenta renovada exitosamente!', `Tu cuenta ha sido renovada por ${duration} ${monthLabel}`);
            
            // Ya no es necesario loadUserAccounts() porque refreshAfterPurchase() ya lo hace
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// Función para probar la conectividad con la API
async function testConnection() {
    try {
        const result = await apiRequest('health');
        if (result.success) {
            console.log('✅ Conexión con API establecida correctamente');
        } else {
            console.warn('⚠️ API responde pero hay problemas:', result.message);
        }
    } catch (error) {
        console.error('❌ Error de conectividad con la API:', error);
        Swal.fire({
            icon: 'warning',
            title: 'Problema de conectividad',
            text: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
            confirmButtonText: 'Entendido',
            footer: '<small>Código de error: ' + error.message + '</small>'
        });
    }
}

// Eventos del DOM
document.addEventListener('DOMContentLoaded', function() {
    showLogin();
    
    // Agregar eventos de Enter para los formularios
    document.getElementById('login-whatsapp').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('login-password').focus();
        }
    });
    
    document.getElementById('login-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    document.getElementById('register-whatsapp').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('register-password').focus();
        }
    });
    
    document.getElementById('register-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            register();
        }
    });

    // Agregar evento de Enter para el campo de gift card
    document.getElementById('giftcard-code').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            redeemGiftcard();
        }
    });

    // Test de conectividad al cargar la página
    testConnection();
});

// === FUNCIONES DE ACTUALIZACIÓN ===

// NUEVA FUNCIÓN: Cargar todos los datos iniciales
async function loadInitialData() {
    if (!currentUser) return;
    
    try {
        showLoadingAlert('Cargando datos...');
        
        // 1. Cargar balance
        await updateBalance();
        
        // 2. Cargar todos los tipos de productos
        await loadAllProductTypes();
        
        // 3. Cargar todos los servicios del usuario
        await loadAllUserServices();
        
        Swal.close();
        console.log('✅ Todos los datos iniciales cargados correctamente');
        
    } catch (error) {
        Swal.close();
        console.error('❌ Error cargando datos iniciales:', error);
        showErrorAlert('Error cargando datos', 'Algunos datos pueden no estar disponibles');
    }
}

// Función para actualizar todos los datos manualmente
async function refreshAllData() {
    if (!currentUser) {
        showErrorAlert('No hay usuario logueado');
        return;
    }
    
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
    }
    
    try {
        // Actualizar balance
        await updateBalance();
        
        // Actualizar todos los productos
        await loadAllProductTypes();
        
        // Actualizar todos los servicios
        await loadAllUserServices();
        
        // Mostrar mensaje de éxito
        showSuccessAlert('¡Datos actualizados!', 'Toda la información se ha actualizado correctamente');
        
    } catch (error) {
        console.error('Error actualizando datos:', error);
        showErrorAlert('Error actualizando datos', error.message);
    } finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('spinning');
        }
    }
}

// Función para iniciar auto-actualización
function startAutoRefresh() {
    stopAutoRefresh(); // Limpiar interval anterior si existe
    
    autoRefreshInterval = setInterval(async () => {
        if (currentUser) {
            try {
                // Solo actualizar balance y contadores silenciosamente
                await updateBalance();
                
                console.log('✅ Balance actualizado automáticamente');
            } catch (error) {
                console.warn('⚠️ Error en auto-actualización:', error);
            }
        }
    }, 60000); // 60 segundos (menos frecuente ya que tenemos botón manual)
    
    console.log('🔄 Auto-actualización iniciada (cada 60 segundos)');
}

// Función para detener auto-actualización
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ Auto-actualización detenida');
    }
}

// Función para actualizar datos después de una compra
async function refreshAfterPurchase() {
    try {
        // Mostrar loading temporal en los contenedores
        showLoadingInContainers();
        
        await updateBalance();
        
        // NUEVO: Recargar servicios del usuario también
        await loadAllUserServices();
        
        console.log('✅ Datos actualizados después de compra/renovación');
    } catch (error) {
        console.error('Error actualizando después de compra:', error);
    }
}

// NUEVA FUNCIÓN: Mostrar loading en contenedores mientras se actualiza
function showLoadingInContainers() {
    const profilesList = document.getElementById('user-profiles-list');
    const accountsList = document.getElementById('user-accounts-list');
    
    if (profilesList) {
        profilesList.innerHTML = '<div class="loading">Actualizando perfiles...</div>';
    }
    
    if (accountsList) {
        accountsList.innerHTML = '<div class="loading">Actualizando cuentas...</div>';
    }
}