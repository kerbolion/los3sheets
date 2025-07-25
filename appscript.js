// Google Apps Script - API REST para Store.link
// Configuración inicial
const SPREADSHEET_ID = '19k8mlgJW5c_uaeGHHuHHTjjmoz_6e9-2MS0ZguEeW-w';

// Función principal para manejar todas las peticiones HTTP
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function doOptions(e) {
  return HtmlService.createHtmlOutput()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Manejador principal de peticiones
function handleRequest(e) {
  try {
    // Obtener parámetros
    const method = e.parameter.method || 'GET';
    const action = e.parameter.action || '';
    const callback = e.parameter.callback; // Para JSONP
    
    // Obtener datos del body para POST
    let requestData = {};
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (error) {
        return createCORSResponse(false, 'Invalid JSON in request body', null, callback);
      }
    }
    
    // Combinar parámetros de URL y body
    const params = { ...e.parameter, ...requestData };
    
    console.log('Request:', { method, action, params });
    
    // Rutear según la acción
    let result;
    switch (action) {
      case 'register':
        result = registerUser(params.whatsapp, params.password);
        break;
        
      case 'login':
        result = loginUser(params.whatsapp, params.password);
        break;
        
      case 'addFunds':
        result = addFunds(params.userId, params.amount);
        break;
        
      case 'redeemGiftcard':
        result = redeemGiftcard(params.giftcardCode, params.userWhatsApp);
        break;
        
      case 'getBalance':
        result = getBalance(params.userId);
        break;
        
      case 'getProducts':
        result = getProducts(params.userId, params.productType); // NUEVO: Filtro por tipo
        break;
        
      case 'createOrder':
        result = createOrder(params.userId, params.productId, params.duration);
        break;
        
      case 'getUserProfiles':
        result = getUserProfiles(params.userWhatsApp);
        break;
        
      case 'getUserAccounts': // NUEVO: Para obtener cuentas del usuario
        result = getUserAccounts(params.userWhatsApp);
        break;
        
      case 'renewProfile':
        result = renewProfile(params.userWhatsApp, params.profileId, params.durationMonths);
        break;
        
      case 'renewAccount': // NUEVO: Para renovar cuentas
        result = renewAccount(params.userWhatsApp, params.accountId, params.durationMonths);
        break;
        
      case 'cleanExpiredProfiles':
        result = cleanExpiredProfiles();
        break;
        
      case 'cleanExpiredAccounts': // NUEVO: Para limpiar cuentas vencidas
        result = cleanExpiredAccounts();
        break;
        
      case 'health':
        result = { success: true, message: 'API funcionando correctamente', timestamp: new Date().toISOString() };
        break;
        
      default:
        result = { success: false, message: 'Acción no válida: ' + action };
        break;
    }
    
    return createCORSResponse(result.success, result.message, result.data, callback);
    
  } catch (error) {
    console.error('Error en handleRequest:', error);
    return createCORSResponse(false, 'Error interno del servidor: ' + error.message, null, callback);
  }
}

// Función auxiliar para crear respuestas con CORS
function createCORSResponse(success, message, data = null, callback = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  let responseText;
  
  // Si hay callback, devolver JSONP
  if (callback) {
    responseText = `${callback}(${JSON.stringify(response)})`;
    const output = ContentService.createTextOutput(responseText);
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  } else {
    // Devolver JSON normal con headers CORS
    responseText = JSON.stringify(response);
    const output = ContentService.createTextOutput(responseText);
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Headers CORS
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Max-Age': '86400'
    });
    
    return output;
  }
}

// Función auxiliar para crear respuestas consistentes (mantenida para compatibilidad)
function createResponse(success, message, data = null) {
  return createCORSResponse(success, message, data, null);
}

// === FUNCIONES DE BACKEND ===

// Obtener referencia a las hojas
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Configurar headers según la hoja
    if (sheetName === 'users') {
      // MODIFICADO: Agregada columna Rol
      sheet.getRange(1, 1, 1, 6).setValues([['ID', 'WhatsApp', 'Password', 'Balance', 'Created', 'Rol']]);
    } else if (sheetName === 'products') {
      // MODIFICADO: Agregada columna ProductType
      const headers = [
        'ID', 'Name', 
        '1 Mes', '2 Meses', '3 Meses', '4 Meses', '5 Meses', '6 Meses', 
        '7 Meses', '8 Meses', '9 Meses', '10 Meses', '11 Meses', '12 Meses',
        '1 Mes - Distribuidor', '2 Meses - Distribuidor', '3 Meses - Distribuidor', 
        '4 Meses - Distribuidor', '5 Meses - Distribuidor', '6 Meses - Distribuidor',
        '7 Meses - Distribuidor', '8 Meses - Distribuidor', '9 Meses - Distribuidor',
        '10 Meses - Distribuidor', '11 Meses - Distribuidor', '12 Meses - Distribuidor',
        'Active', 'ProductType'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else if (sheetName === 'orders') {
      sheet.getRange(1, 1, 1, 7).setValues([['ID', 'UserID', 'ProductID', 'Duration', 'Amount', 'Status', 'Date']]);
    } else if (sheetName === 'perfiles') {
      sheet.getRange(1, 1, 1, 9).setValues([['IDPerfil', 'IDCuenta', 'Plataforma', 'Perfil', 'Pin', 'Resumen', 'IDWhatsApp', 'FechaInicio', 'FechaFinal']]);
    } else if (sheetName === 'cuentas') { // NUEVA HOJA PARA CUENTAS
      sheet.getRange(1, 1, 1, 9).setValues([['IDCuenta', 'Plataforma', 'Cuenta', 'Datos', 'Resumen', 'IDWhatsApp', 'FechaInicio', 'FechaFinal', 'Quedan']]);
    } else if (sheetName === 'giftcards') {
      sheet.getRange(1, 1, 1, 6).setValues([['IDGiftcard', 'Giftcard', 'Monto', 'Estado', 'FechaVencimiento', 'WhatsApp']]);
    }
  }
  
  return sheet;
}

// Función para obtener información del usuario por ID
function getUserById(userId) {
  try {
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userId) {
        return {
          id: users[i][0],
          whatsapp: users[i][0],
          password: users[i][2],
          balance: parseFloat(users[i][3]) || 0,
          created: users[i][4],
          rol: users[i][5] || ''
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

// Registro de usuarios - MODIFICADO para incluir rol
function registerUser(whatsapp, password, rol = '') {
  try {
    if (!whatsapp || !password) {
      return { success: false, message: 'WhatsApp y contraseña son requeridos' };
    }
    
    // Validar formato de WhatsApp
    const cleanWhatsApp = whatsapp.trim();
    if (cleanWhatsApp.length < 8) {
      return { success: false, message: 'Por favor ingresa un número de WhatsApp válido' };
    }
    
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    
    // Verificar si el usuario ya existe
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === cleanWhatsApp) {
        return { success: false, message: 'El número de WhatsApp ya está registrado' };
      }
    }
    
    // Crear nuevo usuario
    const newUser = [cleanWhatsApp, cleanWhatsApp, password, 0, new Date(), rol];
    
    usersSheet.appendRow(newUser);
    
    return { success: true, message: 'Usuario registrado exitosamente', data: { userId: cleanWhatsApp } };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Login de usuarios - MODIFICADO para incluir rol en respuesta
function loginUser(whatsapp, password) {
  try {
    if (!whatsapp || !password) {
      return { success: false, message: 'WhatsApp y contraseña son requeridos' };
    }
    
    const cleanWhatsApp = whatsapp.trim();
    const usersSheet = getSheet('WhatsApp');
    
    // Verificar que la hoja tiene datos
    if (usersSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay usuarios registrados' };
    }
    
    const users = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < users.length; i++) {
      const userWhatsApp = String(users[i][0]).trim();
      const userPassword = String(users[i][2]).trim();
      
      if (userWhatsApp === cleanWhatsApp && userPassword === password) {
        return { 
          success: true, 
          message: 'Login exitoso', 
          data: {
            userId: users[i][0],
            whatsapp: users[i][0],
            balance: parseFloat(users[i][3]) || 0,
            rol: users[i][5] || ''
          }
        };
      }
    }
    
    return { success: false, message: 'Credenciales inválidas' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Agregar fondos al monedero
function addFunds(userId, amount) {
  try {
    if (!userId || !amount || amount <= 0) {
      return { success: false, message: 'Datos inválidos' };
    }
    
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userId) {
        const currentBalance = parseFloat(users[i][3]) || 0;
        const newBalance = currentBalance + parseFloat(amount);
        
        usersSheet.getRange(i + 1, 4).setValue(newBalance);
        
        return { 
          success: true, 
          message: 'Fondos agregados exitosamente', 
          data: { newBalance: newBalance }
        };
      }
    }
    
    return { success: false, message: 'Usuario no encontrado' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Redimir Gift Card
function redeemGiftcard(giftcardCode, userWhatsApp) {
  try {
    if (!giftcardCode || !userWhatsApp) {
      return { success: false, message: 'Código de gift card y WhatsApp son requeridos' };
    }
    
    const cleanCode = giftcardCode.trim();
    const cleanWhatsApp = userWhatsApp.trim();
    
    // Obtener hoja de gift cards
    const giftcardSheet = getSheet('giftcards');
    
    if (giftcardSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay gift cards registradas en el sistema' };
    }
    
    const giftcards = giftcardSheet.getDataRange().getValues();
    
    // Buscar la gift card
    for (let i = 1; i < giftcards.length; i++) {
      const giftcard = giftcards[i];
      const code = String(giftcard[1]).trim(); // Columna Giftcard
      
      if (code === cleanCode) {
        const estado = String(giftcard[3]).trim(); // Columna Estado
        const fechaVencimiento = giftcard[4]; // Columna FechaVencimiento
        const monto = parseFloat(giftcard[2]) || 0; // Columna Monto
        
        // Verificar si ya fue canjeado
        if (estado !== 'Disponible') {
          return { success: false, message: 'Este cupón ya ha sido canjeado' };
        }
        
        // Verificar fecha de vencimiento
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let vencimiento;
        if (fechaVencimiento instanceof Date) {
          vencimiento = new Date(fechaVencimiento);
        } else {
          vencimiento = new Date(fechaVencimiento);
        }
        vencimiento.setHours(0, 0, 0, 0);
        
        if (vencimiento < today) {
          return { success: false, message: 'Este cupón ha expirado' };
        }
        
        // Verificar que el monto sea válido
        if (monto <= 0) {
          return { success: false, message: 'El cupón tiene un monto inválido' };
        }
        
        // Buscar usuario por WhatsApp
        const usersSheet = getSheet('WhatsApp');
        const users = usersSheet.getDataRange().getValues();
        let userFound = false;
        let userRowIndex = -1;
        
        for (let j = 1; j < users.length; j++) {
          if (String(users[j][0]).trim() === cleanWhatsApp) {
            userFound = true;
            userRowIndex = j + 1;
            break;
          }
        }
        
        if (!userFound) {
          return { success: false, message: 'Usuario no encontrado' };
        }
        
        // Actualizar balance del usuario
        const currentBalance = parseFloat(users[userRowIndex - 1][3]) || 0;
        const newBalance = currentBalance + monto;
        usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
        
        // Marcar gift card como canjeado
        giftcardSheet.getRange(i + 1, 4).setValue('Canjeado'); // Columna Estado
        giftcardSheet.getRange(i + 1, 6).setValue(cleanWhatsApp); // Columna WhatsApp
        
        return { 
          success: true, 
          message: 'Cupón canjeado exitosamente', 
          data: { 
            amount: monto,
            newBalance: newBalance 
          }
        };
      }
    }
    
    return { success: false, message: 'Código de cupón inválido' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Obtener balance del usuario
function getBalance(userId) {
  try {
    if (!userId) {
      return { success: false, message: 'ID de usuario requerido' };
    }
    
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userId) {
        return { 
          success: true, 
          message: 'Balance obtenido', 
          data: { balance: parseFloat(users[i][3]) || 0 }
        };
      }
    }
    
    return { success: false, message: 'Usuario no encontrado' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Obtener productos disponibles - MODIFICADO para soportar filtro por tipo
function getProducts(userId = null, productType = null) {
  try {
    const productsSheet = getSheet('products');
    
    // Verificar si hay datos en la hoja
    if (productsSheet.getLastRow() <= 1) {
      console.log('No hay productos en la hoja');
      return { success: true, message: 'No hay productos disponibles', data: [] };
    }
    
    const products = productsSheet.getDataRange().getValues();
    console.log('Productos leídos de la hoja:', products.length - 1);
    
    // Obtener rol del usuario si se proporciona userId
    let userRol = '';
    if (userId) {
      const user = getUserById(userId);
      if (user) {
        userRol = user.rol || '';
      }
    }
    
    const isDistributor = userRol.toLowerCase() === 'distribuidor';
    console.log('Usuario es distribuidor:', isDistributor);
    
    const productList = [];
    for (let i = 1; i < products.length; i++) {
      const row = products[i];
      console.log(`Procesando producto ${i}:`, row);
      
      // Verificar que el producto esté activo (columna 26)
      const isActive = row[26];
      const rowProductType = row[27] || 'license'; // Nueva columna ProductType (posición 27)
      
      console.log(`Producto ${row[1]} - Activo:`, isActive, 'Tipo:', rowProductType);
      
      // Filtrar por tipo si se especifica
      if (productType && rowProductType !== productType) {
        continue;
      }
      
      if (isActive === true || isActive === 'TRUE' || isActive === 'true') {
        const productData = {
          id: row[0],
          name: row[1],
          productType: rowProductType // NUEVO: Incluir tipo de producto
        };
        
        // Agregar precios según el rol del usuario
        for (let month = 1; month <= 12; month++) {
          let priceValue = 0;
          
          if (isDistributor) {
            // Para distribuidores, usar columnas 14-25 (precios de distribuidor)
            priceValue = row[month + 13]; // +13 porque la columna 14 es 1 mes distribuidor
          } else {
            // Para usuarios normales, usar columnas 2-13 (precios normales)
            priceValue = row[month + 1]; // +1 porque la columna 2 es 1 mes normal
          }
          
          const priceProperty = `price${month}Month${month > 1 ? 's' : ''}`;
          productData[priceProperty] = parseFloat(priceValue) || 0;
        }
        
        console.log('Producto agregado:', productData);
        productList.push(productData);
      }
    }
    
    console.log('Lista final de productos:', productList);
    return { success: true, message: 'Productos obtenidos', data: productList };
  } catch (error) {
    console.error('Error en getProducts:', error);
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Crear pedido - MODIFICADO para soportar diferentes tipos de productos
function createOrder(userId, productId, duration = 1) {
  try {
    if (!userId || !productId) {
      return { success: false, message: 'Datos incompletos - Usuario o producto faltante' };
    }
    
    // Validar duración (ahora hasta 12 meses)
    const durationMonths = parseInt(duration) || 1;
    if (durationMonths < 1 || durationMonths > 12) {
      return { success: false, message: 'Duración inválida. Debe ser entre 1 y 12 meses' };
    }
    
    const usersSheet = getSheet('WhatsApp');
    const productsSheet = getSheet('products');
    const ordersSheet = getSheet('orders');
    
    // Obtener información del usuario
    const users = usersSheet.getDataRange().getValues();
    let user = null;
    let userRowIndex = -1;
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userId) {
        user = users[i];
        userRowIndex = i + 1;
        break;
      }
    }
    
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    const userWhatsApp = user[0];
    const userRol = user[5] || ''; // Obtener rol del usuario
    const isDistributor = userRol.toLowerCase() === 'distribuidor';
    
    // Obtener información del producto
    const products = productsSheet.getDataRange().getValues();
    let product = null;
    
    for (let i = 1; i < products.length; i++) {
      if (products[i][0] === productId && products[i][26] === true) { // Columna Active
        product = products[i];
        break;
      }
    }
    
    if (!product) {
      return { success: false, message: 'Producto no encontrado o no disponible' };
    }
    
    // Calcular precio según duración y rol
    let productPrice = 0;
    
    if (isDistributor) {
      // Para distribuidores, usar columnas 14-25 (precios de distribuidor)
      productPrice = parseFloat(product[durationMonths + 13]) || 0;
    } else {
      // Para usuarios normales, usar columnas 2-13 (precios normales)
      productPrice = parseFloat(product[durationMonths + 1]) || 0;
    }
    
    if (productPrice <= 0) {
      return { success: false, message: 'Precio no válido para la duración seleccionada' };
    }
    
    // Verificar balance
    const userBalance = parseFloat(user[3]) || 0;
    
    if (userBalance < productPrice) {
      return { success: false, message: 'Saldo insuficiente' };
    }
    
    let licenseInfo = `Licencia ${product[1]} - ${durationMonths} mes(es)`;
    
    // Crear fecha actual solo con día
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Verificar el tipo de producto y procesar según corresponda
    const productType = product[27] || 'license'; // Columna ProductType
    
    if (productType === 'profiles') {
      const profileResult = findAvailableProfileByPlatform(product[1]);
      
      if (!profileResult.success) {
        return { success: false, message: profileResult.message };
      }
      
      // Calcular fechas
      const startDate = currentDate;
      const endDate = calculateEndDate(startDate, durationMonths);
      
      // Actualizar la hoja perfiles
      const perfilesSheet = getSheet('perfiles');
      perfilesSheet.getRange(profileResult.data.rowIndex, 7).setValue(userWhatsApp);
      perfilesSheet.getRange(profileResult.data.rowIndex, 8).setValue(startDate);
      perfilesSheet.getRange(profileResult.data.rowIndex, 9).setValue(endDate);
      
      licenseInfo = `${profileResult.data.resumen}\n\nDuración: ${durationMonths} mes(es)\nFecha inicio: ${startDate.toLocaleDateString('es-ES')}\nFecha vencimiento: ${endDate.toLocaleDateString('es-ES')}`;
    } else if (productType === 'accounts') {
      const accountResult = findAvailableAccountByPlatform(product[1]);
      
      if (!accountResult.success) {
        return { success: false, message: accountResult.message };
      }
      
      // Calcular fechas
      const startDate = currentDate;
      const endDate = calculateEndDate(startDate, durationMonths);
      
      // Actualizar la hoja cuentas (no tocar Quedan)
      const cuentasSheet = getSheet('cuentas');
      cuentasSheet.getRange(accountResult.data.rowIndex, 6).setValue(userWhatsApp); // IDWhatsApp
      cuentasSheet.getRange(accountResult.data.rowIndex, 7).setValue(startDate); // FechaInicio
      cuentasSheet.getRange(accountResult.data.rowIndex, 8).setValue(endDate); // FechaFinal
      
      licenseInfo = `${accountResult.data.resumen}\n\nDuración: ${durationMonths} mes(es)\nFecha inicio: ${startDate.toLocaleDateString('es-ES')}\nFecha vencimiento: ${endDate.toLocaleDateString('es-ES')}`;
    }
    // Para tipo 'license' no se necesita asignar stock, solo la licencia genérica
    
    // Crear pedido
    const orderId = generateId();
    const newOrder = [orderId, userId, productId, durationMonths, productPrice, 'completed', currentDate];
    ordersSheet.appendRow(newOrder);
    
    // Actualizar balance del usuario
    const newBalance = userBalance - productPrice;
    usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
    
    return { 
      success: true, 
      message: 'Pedido creado exitosamente', 
      data: {
        orderId: orderId,
        license: licenseInfo,
        newBalance: newBalance,
        duration: durationMonths,
        productType: productType
      }
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Buscar perfil disponible por plataforma
function findAvailableProfileByPlatform(platformName) {
  try {
    const perfilesSheet = getSheet('perfiles');
    
    if (perfilesSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay perfiles configurados en el sistema' };
    }
    
    const profiles = perfilesSheet.getDataRange().getValues();
    
    for (let i = 1; i < profiles.length; i++) {
      const idWhatsApp = profiles[i][6];
      const plataforma = profiles[i][2];
      
      // Verificar que el perfil esté disponible y la plataforma coincida
      if ((!idWhatsApp || idWhatsApp === '' || idWhatsApp === null || idWhatsApp === undefined) && 
          plataforma === platformName) {
        return { 
          success: true, 
          data: {
            rowIndex: i + 1,
            profile: profiles[i],
            resumen: profiles[i][5]
          }
        };
      }
    }
    
    return { success: false, message: `No hay perfiles disponibles para ${platformName} en este momento` };
  } catch (error) {
    return { success: false, message: 'Error buscando perfiles: ' + error.message };
  }
}

// NUEVA FUNCIÓN: Buscar cuenta disponible por plataforma
function findAvailableAccountByPlatform(platformName) {
  try {
    const cuentasSheet = getSheet('cuentas');
    
    if (cuentasSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay cuentas configuradas en el sistema' };
    }
    
    const accounts = cuentasSheet.getDataRange().getValues();
    
    for (let i = 1; i < accounts.length; i++) {
      const idWhatsApp = accounts[i][5]; // Columna IDWhatsApp
      const plataforma = accounts[i][1]; // Columna Plataforma
      
      // Verificar que la cuenta esté disponible y la plataforma coincida
      if ((!idWhatsApp || idWhatsApp === '' || idWhatsApp === null || idWhatsApp === undefined) && 
          plataforma === platformName) {
        return { 
          success: true, 
          data: {
            rowIndex: i + 1,
            account: accounts[i],
            resumen: accounts[i][4] // Columna Resumen
          }
        };
      }
    }
    
    return { success: false, message: `No hay cuentas disponibles para ${platformName} en este momento` };
  } catch (error) {
    return { success: false, message: 'Error buscando cuentas: ' + error.message };
  }
}

// Obtener perfiles del usuario
function getUserProfiles(userWhatsApp) {
  try {
    if (!userWhatsApp) {
      return { success: false, message: 'Número de WhatsApp requerido' };
    }
    
    const perfilesSheet = getSheet('perfiles');
    
    if (perfilesSheet.getLastRow() <= 1) {
      return { success: true, message: 'No hay perfiles', data: [] };
    }
    
    const profiles = perfilesSheet.getDataRange().getValues();
    const userProfiles = [];
    
    for (let i = 1; i < profiles.length; i++) {
      const profileWhatsApp = profiles[i][6];
      
      if (profileWhatsApp === userWhatsApp) {
        let fechaInicio = profiles[i][7];
        let fechaFinal = profiles[i][8];
        
        // Convertir fechas si no son objetos Date
        if (fechaInicio && !(fechaInicio instanceof Date)) {
          fechaInicio = new Date(fechaInicio);
        }
        if (fechaFinal && !(fechaFinal instanceof Date)) {
          fechaFinal = new Date(fechaFinal);
        }
        
        userProfiles.push({
          rowIndex: i + 1,
          idPerfil: profiles[i][0] || 'N/A',
          idCuenta: profiles[i][1] || 'N/A',
          plataforma: profiles[i][2] || 'N/A',
          perfil: profiles[i][3] || 'N/A',
          pin: profiles[i][4] || 'N/A',
          resumen: profiles[i][5] || 'N/A',
          idWhatsApp: profiles[i][6] || 'N/A',
          fechaInicio: fechaInicio ? fechaInicio.toISOString() : null,
          fechaFinal: fechaFinal ? fechaFinal.toISOString() : null,
          type: 'profile' // NUEVO: Identificador de tipo
        });
      }
    }
    
    return { success: true, message: 'Perfiles obtenidos', data: userProfiles };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// NUEVA FUNCIÓN: Obtener cuentas del usuario
function getUserAccounts(userWhatsApp) {
  try {
    if (!userWhatsApp) {
      return { success: false, message: 'Número de WhatsApp requerido' };
    }
    
    const cuentasSheet = getSheet('cuentas');
    
    if (cuentasSheet.getLastRow() <= 1) {
      return { success: true, message: 'No hay cuentas', data: [] };
    }
    
    const accounts = cuentasSheet.getDataRange().getValues();
    const userAccounts = [];
    
    for (let i = 1; i < accounts.length; i++) {
      const accountWhatsApp = accounts[i][5]; // Columna IDWhatsApp
      
      if (accountWhatsApp === userWhatsApp) {
        let fechaInicio = accounts[i][6]; // Columna FechaInicio
        let fechaFinal = accounts[i][7]; // Columna FechaFinal
        
        // Convertir fechas si no son objetos Date
        if (fechaInicio && !(fechaInicio instanceof Date)) {
          fechaInicio = new Date(fechaInicio);
        }
        if (fechaFinal && !(fechaFinal instanceof Date)) {
          fechaFinal = new Date(fechaFinal);
        }
        
        userAccounts.push({
          rowIndex: i + 1,
          idCuenta: accounts[i][0] || 'N/A',
          plataforma: accounts[i][1] || 'N/A',
          cuenta: accounts[i][2] || 'N/A',
          datos: accounts[i][3] || 'N/A',
          resumen: accounts[i][4] || 'N/A',
          idWhatsApp: accounts[i][5] || 'N/A',
          fechaInicio: fechaInicio ? fechaInicio.toISOString() : null,
          fechaFinal: fechaFinal ? fechaFinal.toISOString() : null,
          quedan: accounts[i][8] || 'N/A',
          type: 'account' // NUEVO: Identificador de tipo
        });
      }
    }
    
    return { success: true, message: 'Cuentas obtenidas', data: userAccounts };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Renovar perfil existente - CORREGIDO: Usar targetProfile[2] en lugar de platformName
function renewProfile(userWhatsApp, profileId, durationMonths) {
  try {
    if (!userWhatsApp || !profileId || !durationMonths) {
      return { success: false, message: 'Datos incompletos' };
    }
    
    const duration = parseInt(durationMonths);
    if (duration < 1 || duration > 12) {
      return { success: false, message: 'Duración inválida. Debe ser entre 1 y 12 meses' };
    }
    
    // Buscar el perfil para obtener la plataforma
    const perfilesSheet = getSheet('perfiles');
    const profiles = perfilesSheet.getDataRange().getValues();
    let targetProfile = null;
    let profileRowIndex = -1;
    
    for (let i = 1; i < profiles.length; i++) {
      if (profiles[i][0] === profileId && profiles[i][6] === userWhatsApp) {
        targetProfile = profiles[i];
        profileRowIndex = i + 1;
        break;
      }
    }
    
    if (!targetProfile) {
      return { success: false, message: 'Perfil no encontrado' };
    }
    
    // CORREGIDO: Obtener el nombre de la plataforma del perfil encontrado
    const platformName = targetProfile[2]; // Columna Plataforma
    
    // Obtener usuario por WhatsApp para determinar rol
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    let user = null;
    let userRowIndex = -1;
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userWhatsApp) {
        user = users[i];
        userRowIndex = i + 1;
        break;
      }
    }
    
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    const userRol = user[5] || ''; // Obtener rol del usuario
    const isDistributor = userRol.toLowerCase() === 'distribuidor';
    
    // Buscar el producto correspondiente a esta plataforma para obtener precios
    const productsSheet = getSheet('products');
    const products = productsSheet.getDataRange().getValues();
    let productPrice = 0;
    
    for (let i = 1; i < products.length; i++) {
      // Buscar producto tipo 'profiles' para esta plataforma
      if (products[i][1] === platformName && products[i][26] === true && products[i][27] === 'profiles') {
        if (isDistributor) {
          // Para distribuidores, usar columnas 14-25 (precios de distribuidor)
          productPrice = parseFloat(products[i][duration + 13]) || 0;
        } else {
          // Para usuarios normales, usar columnas 2-13 (precios normales)
          productPrice = parseFloat(products[i][duration + 1]) || 0;
        }
        break;
      }
    }
    
    if (productPrice <= 0) {
      return { success: false, message: 'No se pudo determinar el precio para esta renovación' };
    }
    
    // Verificar balance
    const userBalance = parseFloat(user[3]) || 0;
    if (userBalance < productPrice) {
      return { success: false, message: 'Saldo insuficiente' };
    }
    
    // Calcular nueva fecha final
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let newEndDate;
    const existingEndDate = new Date(targetProfile[8]);
    
    if (existingEndDate > currentDate) {
      newEndDate = new Date(existingEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + duration);
    } else {
      newEndDate = new Date(currentDate);
      newEndDate.setMonth(newEndDate.getMonth() + duration);
      perfilesSheet.getRange(profileRowIndex, 8).setValue(currentDate);
    }
    
    newEndDate.setHours(0, 0, 0, 0);
    
    // Actualizar fecha final en el perfil
    perfilesSheet.getRange(profileRowIndex, 9).setValue(newEndDate);
    
    // Crear registro de la renovación
    const ordersSheet = getSheet('orders');
    const orderId = generateId();
    const renewalOrder = [orderId, user[0], 'RENEWAL_PROFILE_' + profileId, duration, productPrice, 'completed', currentDate];
    ordersSheet.appendRow(renewalOrder);
    
    // Actualizar balance del usuario
    const newBalance = userBalance - productPrice;
    usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
    
    return {
      success: true,
      message: 'Perfil renovado exitosamente',
      data: {
        newEndDate: newEndDate.toISOString(),
        newBalance: newBalance
      }
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// NUEVA FUNCIÓN: Renovar cuenta existente
function renewAccount(userWhatsApp, accountId, durationMonths) {
  try {
    if (!userWhatsApp || !accountId || !durationMonths) {
      return { success: false, message: 'Datos incompletos' };
    }
    
    const duration = parseInt(durationMonths);
    if (duration < 1 || duration > 12) {
      return { success: false, message: 'Duración inválida. Debe ser entre 1 y 12 meses' };
    }
    
    // Buscar la cuenta para obtener la plataforma
    const cuentasSheet = getSheet('cuentas');
    const accounts = cuentasSheet.getDataRange().getValues();
    let targetAccount = null;
    let accountRowIndex = -1;
    
    for (let i = 1; i < accounts.length; i++) {
      if (accounts[i][0] === accountId && accounts[i][5] === userWhatsApp) {
        targetAccount = accounts[i];
        accountRowIndex = i + 1;
        break;
      }
    }
    
    if (!targetAccount) {
      return { success: false, message: 'Cuenta no encontrada' };
    }
    
    const platformName = targetAccount[1]; // Columna Plataforma
    
    // Obtener usuario por WhatsApp para determinar rol
    const usersSheet = getSheet('WhatsApp');
    const users = usersSheet.getDataRange().getValues();
    let user = null;
    let userRowIndex = -1;
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][0] === userWhatsApp) {
        user = users[i];
        userRowIndex = i + 1;
        break;
      }
    }
    
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    const userRol = user[5] || ''; // Obtener rol del usuario
    const isDistributor = userRol.toLowerCase() === 'distribuidor';
    
    // Buscar el producto correspondiente a esta plataforma para obtener precios
    const productsSheet = getSheet('products');
    const products = productsSheet.getDataRange().getValues();
    let productPrice = 0;
    
    for (let i = 1; i < products.length; i++) {
      // Buscar producto tipo 'accounts' para esta plataforma
      if (products[i][1] === platformName && products[i][26] === true && products[i][27] === 'accounts') {
        if (isDistributor) {
          // Para distribuidores, usar columnas 14-25 (precios de distribuidor)
          productPrice = parseFloat(products[i][duration + 13]) || 0;
        } else {
          // Para usuarios normales, usar columnas 2-13 (precios normales)
          productPrice = parseFloat(products[i][duration + 1]) || 0;
        }
        break;
      }
    }
    
    if (productPrice <= 0) {
      return { success: false, message: 'No se pudo determinar el precio para esta renovación' };
    }
    
    // Verificar balance
    const userBalance = parseFloat(user[3]) || 0;
    if (userBalance < productPrice) {
      return { success: false, message: 'Saldo insuficiente' };
    }
    
    // Calcular nueva fecha final
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let newEndDate;
    const existingEndDate = new Date(targetAccount[7]); // Columna FechaFinal
    
    if (existingEndDate > currentDate) {
      newEndDate = new Date(existingEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + duration);
    } else {
      newEndDate = new Date(currentDate);
      newEndDate.setMonth(newEndDate.getMonth() + duration);
      cuentasSheet.getRange(accountRowIndex, 7).setValue(currentDate); // FechaInicio
    }
    
    newEndDate.setHours(0, 0, 0, 0);
    
    // Actualizar fecha final en la cuenta (no tocar Quedan)
    cuentasSheet.getRange(accountRowIndex, 8).setValue(newEndDate); // FechaFinal
    
    // Crear registro de la renovación
    const ordersSheet = getSheet('orders');
    const orderId = generateId();
    const renewalOrder = [orderId, user[0], 'RENEWAL_ACCOUNT_' + accountId, duration, productPrice, 'completed', currentDate];
    ordersSheet.appendRow(renewalOrder);
    
    // Actualizar balance del usuario
    const newBalance = userBalance - productPrice;
    usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
    
    return {
      success: true,
      message: 'Cuenta renovada exitosamente',
      data: {
        newEndDate: newEndDate.toISOString(),
        newBalance: newBalance
      }
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Limpiar perfiles vencidos
function cleanExpiredProfiles() {
  try {
    const perfilesSheet = getSheet('perfiles');
    const profiles = perfilesSheet.getDataRange().getValues();
    
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let cleanedCount = 0;
    
    for (let i = 1; i < profiles.length; i++) {
      const fechaFinal = profiles[i][8];
      const idWhatsApp = profiles[i][6];
      
      if (fechaFinal && idWhatsApp && fechaFinal instanceof Date) {
        if (fechaFinal < currentDate) {
          perfilesSheet.getRange(i + 1, 7).setValue('');
          perfilesSheet.getRange(i + 1, 8).setValue('');
          perfilesSheet.getRange(i + 1, 9).setValue('');
          cleanedCount++;
        }
      }
    }
    
    return { success: true, message: `${cleanedCount} perfiles vencidos liberados`, data: { cleanedCount } };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// NUEVA FUNCIÓN: Limpiar cuentas vencidas
function cleanExpiredAccounts() {
  try {
    const cuentasSheet = getSheet('cuentas');
    const accounts = cuentasSheet.getDataRange().getValues();
    
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let cleanedCount = 0;
    
    for (let i = 1; i < accounts.length; i++) {
      const fechaFinal = accounts[i][7]; // Columna FechaFinal
      const idWhatsApp = accounts[i][5]; // Columna IDWhatsApp
      
      if (fechaFinal && idWhatsApp && fechaFinal instanceof Date) {
        if (fechaFinal < currentDate) {
          cuentasSheet.getRange(i + 1, 6).setValue(''); // IDWhatsApp
          cuentasSheet.getRange(i + 1, 7).setValue(''); // FechaInicio
          cuentasSheet.getRange(i + 1, 8).setValue(''); // FechaFinal
          cleanedCount++;
        }
      }
    }
    
    return { success: true, message: `${cleanedCount} cuentas vencidas liberadas`, data: { cleanedCount } };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Calcular fecha final
function calculateEndDate(startDate, durationMonths) {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);
  endDate.setHours(0, 0, 0, 0);
  return endDate;
}

// Generar ID único
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Función para inicializar todas las hojas - MODIFICADO para incluir ProductType
function initializeAllSheets() {
  const usersSheet = getSheet('WhatsApp');
  const productsSheet = getSheet('products');
  const ordersSheet = getSheet('orders');
  const perfilesSheet = getSheet('perfiles');
  const cuentasSheet = getSheet('cuentas'); // NUEVA HOJA
  const giftcardsSheet = getSheet('giftcards');
  
  // Agregar productos de ejemplo si la hoja está vacía
  if (productsSheet.getLastRow() <= 1) {
    const sampleProducts = [
      // [ID, Name, Precios normales 1-12 meses, Precios distribuidor 1-12 meses, Active, ProductType]
      [
        generateId(), 'Netflix', 
        // Precios normales (1-12 meses)
        29.99, 54.99, 79.99, 99.99, 119.99, 139.99, 159.99, 179.99, 199.99, 219.99, 239.99, 259.99,
        // Precios distribuidor (1-12 meses) - 20% más baratos
        23.99, 43.99, 63.99, 79.99, 95.99, 111.99, 127.99, 143.99, 159.99, 175.99, 191.99, 207.99,
        true, 'profiles'
      ],
      [
        generateId(), 'Netflix', 
        // Precios normales (1-12 meses) - Más baratos para cuentas
        19.99, 34.99, 49.99, 64.99, 79.99, 94.99, 109.99, 124.99, 139.99, 154.99, 169.99, 184.99,
        // Precios distribuidor (1-12 meses) - 20% más baratos
        15.99, 27.99, 39.99, 51.99, 63.99, 75.99, 87.99, 99.99, 111.99, 123.99, 135.99, 147.99,
        true, 'accounts'
      ],
      [
        generateId(), 'Disney+', 
        // Precios normales (1-12 meses)
        49.99, 89.99, 129.99, 169.99, 199.99, 229.99, 259.99, 289.99, 319.99, 349.99, 379.99, 409.99,
        // Precios distribuidor (1-12 meses) - 20% más baratos
        39.99, 71.99, 103.99, 135.99, 159.99, 183.99, 207.99, 231.99, 255.99, 279.99, 303.99, 327.99,
        true, 'profiles'
      ],
      [
        generateId(), 'Spotify', 
        // Precios normales (1-12 meses)
        19.99, 34.99, 49.99, 64.99, 79.99, 94.99, 109.99, 124.99, 139.99, 154.99, 169.99, 184.99,
        // Precios distribuidor (1-12 meses) - 20% más baratos
        15.99, 27.99, 39.99, 51.99, 63.99, 75.99, 87.99, 99.99, 111.99, 123.99, 135.99, 147.99,
        true, 'license'
      ]
    ];
    
    sampleProducts.forEach(product => {
      productsSheet.appendRow(product);
    });
  }
  
  // Agregar cuentas de ejemplo si la hoja está vacía
  if (cuentasSheet.getLastRow() <= 1) {
    const sampleAccounts = [
      [generateId(), 'Netflix', '123', 'Correo: netflix1@example.com\nContraseña: password123', 'Netflix Cuenta Premium\nCorreo: netflix1@example.com\nContraseña: password123', '', '', '', 'Disponible'],
      [generateId(), 'Netflix', '456', 'Correo: netflix2@example.com\nContraseña: password456', 'Netflix Cuenta Premium\nCorreo: netflix2@example.com\nContraseña: password456', '', '', '', 'Disponible']
    ];
    
    sampleAccounts.forEach(account => {
      cuentasSheet.appendRow(account);
    });
  }
  
  // Agregar gift cards de ejemplo si la hoja está vacía
  if (giftcardsSheet.getLastRow() <= 1) {
    const sampleGiftcards = [
      [generateId(), 'GIFT2024001', 50.00, 'Disponible', new Date('2024-12-31'), ''],
      [generateId(), 'GIFT2024002', 25.00, 'Disponible', new Date('2024-12-31'), ''],
      [generateId(), 'GIFT2024003', 100.00, 'Disponible', new Date('2024-12-31'), '']
    ];
    
    sampleGiftcards.forEach(giftcard => {
      giftcardsSheet.appendRow(giftcard);
    });
  }
  
  console.log('Hojas inicializadas correctamente');
}