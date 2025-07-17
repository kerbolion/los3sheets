// Configuración de la API - JSONP (Sin CORS)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyBbfvbxT0yfAGRfS7w3v61MWSsoFPy50tkdBuWRbgI--Qt6jQyGS2zGZdum3PbiB63tA/exec';

let currentUser = null;
let productsData = [];
let requestCounter = 0;

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

// Funciones de navegación
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
    document.getElementById('profiles-section').classList.add('hidden');
    updateNavLinks(0);
    
    // Mostrar indicador de carga antes de recargar
    const productsGrid = document.getElementById('products-grid');
    productsGrid.innerHTML = '<div class="loading">Cargando productos...</div>';
    
    // Recargar productos cada vez que se accede a la pestaña
    loadProducts();
}

function showWallet() {
    document.getElementById('products-section').classList.add('hidden');
    document.getElementById('wallet-section').classList.remove('hidden');
    document.getElementById('profiles-section').classList.add('hidden');
    updateNavLinks(1);
}

function showProfiles() {
    document.getElementById('products-section').classList.add('hidden');
    document.getElementById('wallet-section').classList.add('hidden');
    document.getElementById('profiles-section').classList.remove('hidden');
    updateNavLinks(2);
    loadUserProfiles();
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

function setButtonsDisabled(disabled) {
    document.querySelectorAll('.btn').forEach(button => button.disabled = disabled);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccessAlert('¡Copiado!', 'La licencia se ha copiado al portapapeles');
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
        showSuccessAlert('¡Copiado!', 'La licencia se ha copiado al portapapeles');
    } catch (err) {
        showErrorAlert('No se pudo copiar', 'Por favor copia manualmente la licencia');
    }
    document.body.removeChild(textArea);
}

// Función para copiar perfil al portapapeles
function copyProfileToClipboard(profileData) {
    copyToClipboard(profileData);
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
            
            // NUEVO: Mostrar indicador de rol si es distribuidor
            updateUserInterface();
            
            updateBalance();
            loadProducts();
            
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

// NUEVA: Función para actualizar la interfaz según el rol del usuario
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
    productsData = [];
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

// Función para cargar productos - MODIFICADA para enviar userId y mostrar precios según rol
async function loadProducts() {
    try {
        // MODIFICADO: Enviar userId para obtener precios según rol
        const result = await apiRequest('getProducts', { userId: currentUser.userId });
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '';

        if (result.success && result.data.length > 0) {
            productsData = result.data;
            
            // NUEVO: Mostrar indicador de precios según rol
            const priceIndicator = document.createElement('div');
            priceIndicator.className = 'price-indicator';
            if (currentUser.rol && currentUser.rol.toLowerCase() === 'distribuidor') {
                priceIndicator.innerHTML = '<span class="distributor-badge">📊 Precios de Distribuidor</span>';
            } else {
                priceIndicator.innerHTML = '<span class="regular-badge">💰 Precios Regulares</span>';
            }
            productsGrid.appendChild(priceIndicator);
            
            result.data.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                
                let productHTML = `<div class="product-name">${product.name}</div>`;
                
                // Si el producto tiene usesProfiles = true, agregar selector de duración
                if (product.usesProfiles) {
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
                    } else {
                        // Si no hay precios disponibles, mostrar producto no disponible
                        productHTML += `
                            <div class="product-price">No disponible</div>
                            <button class="btn" disabled>No disponible</button>
                        `;
                    }
                } else {
                    // Para productos que no usan perfiles, mostrar precio normal (1 mes)
                    if (product.price1Month && product.price1Month > 0) {
                        productHTML += `
                            <div class="product-price">$${product.price1Month.toFixed(2)}</div>
                            <button class="btn" onclick="buyProduct('${product.id}')">Comprar</button>
                        `;
                    } else {
                        productHTML += `
                            <div class="product-price">No disponible</div>
                            <button class="btn" disabled>No disponible</button>
                        `;
                    }
                }
                
                productCard.innerHTML = productHTML;
                productsGrid.appendChild(productCard);
            });
        } else {
            productsGrid.innerHTML = '<div class="loading">No hay productos disponibles</div>';
        }
    } catch (error) {
        document.getElementById('products-grid').innerHTML = '<div class="loading">Error cargando productos</div>';
        showErrorAlert('Error cargando productos', error.message);
    }
}


// Función para actualizar precio del producto - MODIFICADA para soportar 12 meses
function updateProductPrice(productId, selectElement) {
    const selectedDuration = parseInt(selectElement.value);
    const product = productsData.find(p => p.id === productId);
    
    if (product) {
        const priceProperty = `price${selectedDuration}Month${selectedDuration > 1 ? 's' : ''}`;
        const price = product[priceProperty] || 0;
        
        if (price > 0) {
            const priceElement = selectElement.closest('.product-card').querySelector('.product-price');
            priceElement.textContent = `$${price.toFixed(2)}`;
        }
    }
}

// Función para comprar producto - MODIFICADA para soportar 12 meses
async function buyProduct(productId) {
    if (!currentUser) {
        showErrorAlert('Error: Usuario no válido');
        return;
    }
    
    const product = productsData.find(p => p.id === productId);
    if (!product) {
        showErrorAlert('Error: Producto no encontrado');
        return;
    }
    
    let duration = 1; // Por defecto 1 mes
    let selectedPrice = 0;
    
    // Si el producto usa perfiles, obtener la duración seleccionada
    if (product.usesProfiles) {
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
    const confirmResult = await showConfirmAlert(
        '¿Confirmar compra?',
        `¿Quieres comprar "${product.name}" por $${selectedPrice.toFixed(2)}${duration > 1 ? ` (${duration} ${duration === 1 ? 'mes' : 'meses'})` : ''}${rolText}?`,
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
            showSuccessAlert('¡Compra realizada exitosamente!', 'Redirigiendo a tus perfiles...');
            updateBalance();
            // Redirect a la sección de perfiles después de 2 segundos
            setTimeout(() => {
                showProfiles();
            }, 2000);
        } else {
            showErrorAlert(result.message);
        }
    } catch (error) {
        Swal.close();
        setButtonsDisabled(false);
        showErrorAlert('Error del servidor', error.message);
    }
}

// Función para agregar fondos
async function addFunds() {
    const { value: amount } = await Swal.fire({
        title: 'Agregar Fondos',
        input: 'number',
        inputLabel: 'Cantidad a agregar ($)',
        inputPlaceholder: 'Ingresa la cantidad',
        inputAttributes: {
            min: '0.01',
            step: '0.01'
        },
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || parseFloat(value) <= 0) {
                return 'Por favor ingresa una cantidad válida mayor a 0';
            }
        }
    });

    if (amount) {
        showLoadingAlert('Agregando fondos...');
        setButtonsDisabled(true);

        try {
            const result = await apiRequest('addFunds', { 
                userId: currentUser.userId, 
                amount: parseFloat(amount) 
            });
            
            Swal.close();
            setButtonsDisabled(false);

            if (result.success) {
                showSuccessAlert('¡Fondos agregados!', `Se agregaron $${parseFloat(amount).toFixed(2)} a tu cuenta`);
                updateBalance();
            } else {
                showErrorAlert(result.message);
            }
        } catch (error) {
            Swal.close();
            setButtonsDisabled(false);
            showErrorAlert('Error del servidor', error.message);
        }
    }
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
            // Ordenar perfiles por fecha de inicio (más reciente primero)
            const sortedProfiles = result.data.sort((a, b) => {
                return new Date(b.fechaInicio) - new Date(a.fechaInicio);
            });
            
            sortedProfiles.forEach(profile => {
                const profileCard = createProfileCard(profile);
                profilesList.appendChild(profileCard);
            });
        } else {
            profilesList.innerHTML = `
                <div class="no-profiles">
                    <h3>No tienes perfiles activos</h3>
                    <p>Compra un producto que use perfiles para obtener tu primer perfil</p>
                </div>
            `;
        }
    } catch (error) {
        profilesList.innerHTML = '<div class="loading">Error cargando perfiles</div>';
        showErrorAlert('Error cargando perfiles', error.message);
    }
}

// Función para crear tarjeta de perfil - MODIFICADA para mostrar precios según rol
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
    const platformProduct = productsData.find(p => p.name === profile.plataforma);
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
            <button class="btn btn-copy" onclick="copyProfileToClipboard('${escapedResumen}')">
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

// Función para renovar perfil - MODIFICADA para soportar 12 meses
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
        `¿Confirmas la renovación por ${duration} ${monthLabel} por $${price.toFixed(2)}${roleIndicator}?`,
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
            showSuccessAlert('¡Perfil renovado exitosamente!', `Tu perfil ha sido renovado por ${duration} ${monthLabel}`);
            updateBalance();
            loadUserProfiles(); // Recargar perfiles
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

    // Test de conectividad al cargar la página
    testConnection();
});