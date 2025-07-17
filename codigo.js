// Google Apps Script - API REST para Store.link
// Configuración inicial
const SPREADSHEET_ID = '1ue0VJVvl1vqg4jiSunxaIAYNrHC_ILqpM8ZW48l_dP4';

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
        
      case 'getBalance':
        result = getBalance(params.userId);
        break;
        
      case 'getProducts':
        result = getProducts();
        break;
        
      case 'createOrder':
        result = createOrder(params.userId, params.productId, params.duration);
        break;
        
      case 'getUserProfiles':
        result = getUserProfiles(params.userWhatsApp);
        break;
        
      case 'renewProfile':
        result = renewProfile(params.userWhatsApp, params.profileId, params.durationMonths);
        break;
        
      case 'cleanExpiredProfiles':
        result = cleanExpiredProfiles();
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

// === FUNCIONES DE BACKEND (mantener las existentes con pequeñas modificaciones) ===

// Obtener referencia a las hojas
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Configurar headers según la hoja
    if (sheetName === 'users') {
      sheet.getRange(1, 1, 1, 5).setValues([['ID', 'WhatsApp', 'Password', 'Balance', 'Created']]);
    } else if (sheetName === 'products') {
      sheet.getRange(1, 1, 1, 6).setValues([['ID', 'Name', '1 Mes', '2 Meses', '3 Meses', 'Active']]);
    } else if (sheetName === 'orders') {
      sheet.getRange(1, 1, 1, 7).setValues([['ID', 'UserID', 'ProductID', 'Duration', 'Amount', 'Status', 'Date']]);
    } else if (sheetName === 'perfiles') {
      sheet.getRange(1, 1, 1, 9).setValues([['IDPerfil', 'IDCuenta', 'Plataforma', 'Perfil', 'Pin', 'Resumen', 'IDWhatsApp', 'FechaInicio', 'FechaFinal']]);
    }
  }
  
  return sheet;
}

// Registro de usuarios
function registerUser(whatsapp, password) {
  try {
    if (!whatsapp || !password) {
      return { success: false, message: 'WhatsApp y contraseña son requeridos' };
    }
    
    // Validar formato de WhatsApp
    const cleanWhatsApp = whatsapp.trim();
    if (cleanWhatsApp.length < 8) {
      return { success: false, message: 'Por favor ingresa un número de WhatsApp válido' };
    }
    
    const usersSheet = getSheet('users');
    const users = usersSheet.getDataRange().getValues();
    
    // Verificar si el usuario ya existe
    for (let i = 1; i < users.length; i++) {
      if (users[i][1] === cleanWhatsApp) {
        return { success: false, message: 'El número de WhatsApp ya está registrado' };
      }
    }
    
    // Crear nuevo usuario
    const userId = generateId();
    const newUser = [userId, cleanWhatsApp, password, 0, new Date()];
    
    usersSheet.appendRow(newUser);
    
    return { success: true, message: 'Usuario registrado exitosamente', data: { userId: userId } };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Login de usuarios
function loginUser(whatsapp, password) {
  try {
    if (!whatsapp || !password) {
      return { success: false, message: 'WhatsApp y contraseña son requeridos' };
    }
    
    const cleanWhatsApp = whatsapp.trim();
    const usersSheet = getSheet('users');
    
    // Verificar que la hoja tiene datos
    if (usersSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay usuarios registrados' };
    }
    
    const users = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < users.length; i++) {
      const userWhatsApp = String(users[i][1]).trim();
      const userPassword = String(users[i][2]).trim();
      
      if (userWhatsApp === cleanWhatsApp && userPassword === password) {
        return { 
          success: true, 
          message: 'Login exitoso', 
          data: {
            userId: users[i][0],
            whatsapp: users[i][1],
            balance: parseFloat(users[i][3]) || 0
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
    
    const usersSheet = getSheet('users');
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

// Obtener balance del usuario
function getBalance(userId) {
  try {
    if (!userId) {
      return { success: false, message: 'ID de usuario requerido' };
    }
    
    const usersSheet = getSheet('users');
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

// Obtener productos disponibles
function getProducts() {
  try {
    const productsSheet = getSheet('products');
    const products = productsSheet.getDataRange().getValues();
    
    if (products.length <= 1) {
      return { success: true, message: 'No hay productos disponibles', data: [] };
    }
    
    const productList = [];
    for (let i = 1; i < products.length; i++) {
      if (products[i][5] === true) { // Solo productos activos
        productList.push({
          id: products[i][0],
          name: products[i][1],
          price1Month: parseFloat(products[i][2]) || 0,
          price2Months: parseFloat(products[i][3]) || 0,
          price3Months: parseFloat(products[i][4]) || 0
        });
      }
    }
    
    return { success: true, message: 'Productos obtenidos', data: productList };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Crear pedido
function createOrder(userId, productId, duration = 1) {
  try {
    if (!userId || !productId) {
      return { success: false, message: 'Datos incompletos - Usuario o producto faltante' };
    }
    
    // Validar duración
    const durationMonths = parseInt(duration) || 1;
    if (durationMonths < 1 || durationMonths > 3) {
      return { success: false, message: 'Duración inválida. Debe ser 1, 2 o 3 meses' };
    }
    
    const usersSheet = getSheet('users');
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
    
    const userWhatsApp = user[1];
    
    // Obtener información del producto
    const products = productsSheet.getDataRange().getValues();
    let product = null;
    
    for (let i = 1; i < products.length; i++) {
      if (products[i][0] === productId && products[i][5] === true) {
        product = products[i];
        break;
      }
    }
    
    if (!product) {
      return { success: false, message: 'Producto no encontrado o no disponible' };
    }
    
    // Calcular precio según duración
    let productPrice = 0;
    switch(durationMonths) {
      case 1:
        productPrice = parseFloat(product[2]) || 0;
        break;
      case 2:
        productPrice = parseFloat(product[3]) || 0;
        break;
      case 3:
        productPrice = parseFloat(product[4]) || 0;
        break;
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
    
    // Si es "Licencia Software A", buscar perfil disponible y actualizar fechas
    if (product[1] === 'Licencia Software A') {
      const profileResult = findAvailableProfile();
      
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
    }
    
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
        duration: durationMonths
      }
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Buscar perfil disponible
function findAvailableProfile() {
  try {
    const perfilesSheet = getSheet('perfiles');
    
    if (perfilesSheet.getLastRow() <= 1) {
      return { success: false, message: 'No hay perfiles configurados en el sistema' };
    }
    
    const profiles = perfilesSheet.getDataRange().getValues();
    
    for (let i = 1; i < profiles.length; i++) {
      const idWhatsApp = profiles[i][6];
      
      if (!idWhatsApp || idWhatsApp === '' || idWhatsApp === null || idWhatsApp === undefined) {
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
    
    return { success: false, message: 'No hay perfiles disponibles en este momento' };
  } catch (error) {
    return { success: false, message: 'Error buscando perfiles: ' + error.message };
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
          fechaFinal: fechaFinal ? fechaFinal.toISOString() : null
        });
      }
    }
    
    return { success: true, message: 'Perfiles obtenidos', data: userProfiles };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.message };
  }
}

// Renovar perfil existente
function renewProfile(userWhatsApp, profileId, durationMonths) {
  try {
    if (!userWhatsApp || !profileId || !durationMonths) {
      return { success: false, message: 'Datos incompletos' };
    }
    
    const duration = parseInt(durationMonths);
    if (duration < 1 || duration > 3) {
      return { success: false, message: 'Duración inválida. Debe ser 1, 2 o 3 meses' };
    }
    
    // Calcular precio según duración
    let price = 0;
    switch(duration) {
      case 1: price = 29.99; break;
      case 2: price = 54.99; break;
      case 3: price = 79.99; break;
    }
    
    // Obtener usuario por WhatsApp
    const usersSheet = getSheet('users');
    const users = usersSheet.getDataRange().getValues();
    let user = null;
    let userRowIndex = -1;
    
    for (let i = 1; i < users.length; i++) {
      if (users[i][1] === userWhatsApp) {
        user = users[i];
        userRowIndex = i + 1;
        break;
      }
    }
    
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    // Verificar balance
    const userBalance = parseFloat(user[3]) || 0;
    if (userBalance < price) {
      return { success: false, message: 'Saldo insuficiente' };
    }
    
    // Buscar el perfil específico
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
    const renewalOrder = [orderId, user[0], 'RENEWAL_' + profileId, duration, price, 'completed', currentDate];
    ordersSheet.appendRow(renewalOrder);
    
    // Actualizar balance del usuario
    const newBalance = userBalance - price;
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

// Función para inicializar todas las hojas
function initializeAllSheets() {
  const usersSheet = getSheet('users');
  const productsSheet = getSheet('products');
  const ordersSheet = getSheet('orders');
  const perfilesSheet = getSheet('perfiles');
  
  // Agregar productos de ejemplo si la hoja está vacía
  if (productsSheet.getLastRow() <= 1) {
    const sampleProducts = [
      [generateId(), 'Licencia Software A', 29.99, 54.99, 79.99, true],
      [generateId(), 'Licencia Software B', 49.99, 89.99, 129.99, true],
      [generateId(), 'Licencia Premium', 99.99, 179.99, 249.99, true]
    ];
    
    sampleProducts.forEach(product => {
      productsSheet.appendRow(product);
    });
  }
  
  console.log('Hojas inicializadas correctamente');
}


// // Google Apps Script - API REST para Store.link
// // Configuración inicial
// const SPREADSHEET_ID = '1ue0VJVvl1vqg4jiSunxaIAYNrHC_ILqpM8ZW48l_dP4';

// // Función principal para manejar todas las peticiones HTTP
// function doGet(e) {
//   return handleRequest(e);
// }

// function doPost(e) {
//   return handleRequest(e);
// }

// function doOptions(e) {
//   return HtmlService.createHtmlOutput()
//     .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
// }

// // Manejador principal de peticiones
// function handleRequest(e) {
//   try {
//     // Obtener parámetros
//     const method = e.parameter.method || 'GET';
//     const action = e.parameter.action || '';
//     const callback = e.parameter.callback; // Para JSONP
    
//     // Obtener datos del body para POST
//     let requestData = {};
//     if (e.postData && e.postData.contents) {
//       try {
//         requestData = JSON.parse(e.postData.contents);
//       } catch (error) {
//         return createCORSResponse(false, 'Invalid JSON in request body', null, callback);
//       }
//     }
    
//     // Combinar parámetros de URL y body
//     const params = { ...e.parameter, ...requestData };
    
//     console.log('Request:', { method, action, params });
    
//     // Rutear según la acción
//     let result;
//     switch (action) {
//       case 'register':
//         result = registerUser(params.whatsapp, params.password);
//         break;
        
//       case 'login':
//         result = loginUser(params.whatsapp, params.password);
//         break;
        
//       case 'addFunds':
//         result = addFunds(params.userId, params.amount);
//         break;
        
//       case 'getBalance':
//         result = getBalance(params.userId);
//         break;
        
//       case 'getProducts':
//         result = getProducts();
//         break;
        
//       case 'createOrder':
//         result = createOrder(params.userId, params.productId, params.duration);
//         break;
        
//       case 'getUserProfiles':
//         result = getUserProfiles(params.userWhatsApp);
//         break;
        
//       case 'renewProfile':
//         result = renewProfile(params.userWhatsApp, params.profileId, params.durationMonths);
//         break;
        
//       case 'cleanExpiredProfiles':
//         result = cleanExpiredProfiles();
//         break;
        
//       case 'health':
//         result = { success: true, message: 'API funcionando correctamente', timestamp: new Date().toISOString() };
//         break;
        
//       default:
//         result = { success: false, message: 'Acción no válida: ' + action };
//         break;
//     }
    
//     return createCORSResponse(result.success, result.message, result.data, callback);
    
//   } catch (error) {
//     console.error('Error en handleRequest:', error);
//     return createCORSResponse(false, 'Error interno del servidor: ' + error.message, null, callback);
//   }
// }
    
//     // Rutear según la acción
// // Función auxiliar para crear respuestas con CORS
// function createCORSResponse(success, message, data = null, callback = null) {
//   const response = {
//     success: success,
//     message: message,
//     timestamp: new Date().toISOString()
//   };
  
//   if (data !== null) {
//     response.data = data;
//   }
  
//   let responseText;
  
//   // Si hay callback, devolver JSONP
//   if (callback) {
//     responseText = `${callback}(${JSON.stringify(response)})`;
//     const output = ContentService.createTextOutput(responseText);
//     output.setMimeType(ContentService.MimeType.JAVASCRIPT);
//     return output;
//   } else {
//     // Devolver JSON normal con headers CORS
//     responseText = JSON.stringify(response);
//     const output = ContentService.createTextOutput(responseText);
//     output.setMimeType(ContentService.MimeType.JSON);
    
//     // Headers CORS
//     output.setHeaders({
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
//       'Access-Control-Max-Age': '86400'
//     });
    
//     return output;
//   }
// }

// // Función auxiliar para crear respuestas consistentes (mantenida para compatibilidad)
// function createResponse(success, message, data = null) {
//   return createCORSResponse(success, message, data, null);
// }

// // === FUNCIONES DE BACKEND (mantener las existentes con pequeñas modificaciones) ===

// // Obtener referencia a las hojas
// function getSheet(sheetName) {
//   const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
//   let sheet = ss.getSheetByName(sheetName);
  
//   if (!sheet) {
//     sheet = ss.insertSheet(sheetName);
    
//     // Configurar headers según la hoja
//     if (sheetName === 'users') {
//       sheet.getRange(1, 1, 1, 5).setValues([['ID', 'WhatsApp', 'Password', 'Balance', 'Created']]);
//     } else if (sheetName === 'products') {
//       sheet.getRange(1, 1, 1, 6).setValues([['ID', 'Name', '1 Mes', '2 Meses', '3 Meses', 'Active']]);
//     } else if (sheetName === 'orders') {
//       sheet.getRange(1, 1, 1, 7).setValues([['ID', 'UserID', 'ProductID', 'Duration', 'Amount', 'Status', 'Date']]);
//     } else if (sheetName === 'perfiles') {
//       sheet.getRange(1, 1, 1, 9).setValues([['IDPerfil', 'IDCuenta', 'Plataforma', 'Perfil', 'Pin', 'Resumen', 'IDWhatsApp', 'FechaInicio', 'FechaFinal']]);
//     }
//   }
  
//   return sheet;
// }

// // Registro de usuarios
// function registerUser(whatsapp, password) {
//   try {
//     if (!whatsapp || !password) {
//       return { success: false, message: 'WhatsApp y contraseña son requeridos' };
//     }
    
//     // Validar formato de WhatsApp
//     const cleanWhatsApp = whatsapp.trim();
//     if (cleanWhatsApp.length < 8) {
//       return { success: false, message: 'Por favor ingresa un número de WhatsApp válido' };
//     }
    
//     const usersSheet = getSheet('users');
//     const users = usersSheet.getDataRange().getValues();
    
//     // Verificar si el usuario ya existe
//     for (let i = 1; i < users.length; i++) {
//       if (users[i][1] === cleanWhatsApp) {
//         return { success: false, message: 'El número de WhatsApp ya está registrado' };
//       }
//     }
    
//     // Crear nuevo usuario
//     const userId = generateId();
//     const newUser = [userId, cleanWhatsApp, password, 0, new Date()];
    
//     usersSheet.appendRow(newUser);
    
//     return { success: true, message: 'Usuario registrado exitosamente', data: { userId: userId } };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Login de usuarios
// function loginUser(whatsapp, password) {
//   try {
//     if (!whatsapp || !password) {
//       return { success: false, message: 'WhatsApp y contraseña son requeridos' };
//     }
    
//     const cleanWhatsApp = whatsapp.trim();
//     const usersSheet = getSheet('users');
    
//     // Verificar que la hoja tiene datos
//     if (usersSheet.getLastRow() <= 1) {
//       return { success: false, message: 'No hay usuarios registrados' };
//     }
    
//     const users = usersSheet.getDataRange().getValues();
    
//     for (let i = 1; i < users.length; i++) {
//       const userWhatsApp = String(users[i][1]).trim();
//       const userPassword = String(users[i][2]).trim();
      
//       if (userWhatsApp === cleanWhatsApp && userPassword === password) {
//         return { 
//           success: true, 
//           message: 'Login exitoso', 
//           data: {
//             userId: users[i][0],
//             whatsapp: users[i][1],
//             balance: parseFloat(users[i][3]) || 0
//           }
//         };
//       }
//     }
    
//     return { success: false, message: 'Credenciales inválidas' };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Agregar fondos al monedero
// function addFunds(userId, amount) {
//   try {
//     if (!userId || !amount || amount <= 0) {
//       return { success: false, message: 'Datos inválidos' };
//     }
    
//     const usersSheet = getSheet('users');
//     const users = usersSheet.getDataRange().getValues();
    
//     for (let i = 1; i < users.length; i++) {
//       if (users[i][0] === userId) {
//         const currentBalance = parseFloat(users[i][3]) || 0;
//         const newBalance = currentBalance + parseFloat(amount);
        
//         usersSheet.getRange(i + 1, 4).setValue(newBalance);
        
//         return { 
//           success: true, 
//           message: 'Fondos agregados exitosamente', 
//           data: { newBalance: newBalance }
//         };
//       }
//     }
    
//     return { success: false, message: 'Usuario no encontrado' };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Obtener balance del usuario
// function getBalance(userId) {
//   try {
//     if (!userId) {
//       return { success: false, message: 'ID de usuario requerido' };
//     }
    
//     const usersSheet = getSheet('users');
//     const users = usersSheet.getDataRange().getValues();
    
//     for (let i = 1; i < users.length; i++) {
//       if (users[i][0] === userId) {
//         return { 
//           success: true, 
//           message: 'Balance obtenido', 
//           data: { balance: parseFloat(users[i][3]) || 0 }
//         };
//       }
//     }
    
//     return { success: false, message: 'Usuario no encontrado' };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Obtener productos disponibles
// function getProducts() {
//   try {
//     const productsSheet = getSheet('products');
//     const products = productsSheet.getDataRange().getValues();
    
//     if (products.length <= 1) {
//       return { success: true, message: 'No hay productos disponibles', data: [] };
//     }
    
//     const productList = [];
//     for (let i = 1; i < products.length; i++) {
//       if (products[i][5] === true) { // Solo productos activos
//         productList.push({
//           id: products[i][0],
//           name: products[i][1],
//           price1Month: parseFloat(products[i][2]) || 0,
//           price2Months: parseFloat(products[i][3]) || 0,
//           price3Months: parseFloat(products[i][4]) || 0
//         });
//       }
//     }
    
//     return { success: true, message: 'Productos obtenidos', data: productList };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Crear pedido
// function createOrder(userId, productId, duration = 1) {
//   try {
//     if (!userId || !productId) {
//       return { success: false, message: 'Datos incompletos - Usuario o producto faltante' };
//     }
    
//     // Validar duración
//     const durationMonths = parseInt(duration) || 1;
//     if (durationMonths < 1 || durationMonths > 3) {
//       return { success: false, message: 'Duración inválida. Debe ser 1, 2 o 3 meses' };
//     }
    
//     const usersSheet = getSheet('users');
//     const productsSheet = getSheet('products');
//     const ordersSheet = getSheet('orders');
    
//     // Obtener información del usuario
//     const users = usersSheet.getDataRange().getValues();
//     let user = null;
//     let userRowIndex = -1;
    
//     for (let i = 1; i < users.length; i++) {
//       if (users[i][0] === userId) {
//         user = users[i];
//         userRowIndex = i + 1;
//         break;
//       }
//     }
    
//     if (!user) {
//       return { success: false, message: 'Usuario no encontrado' };
//     }
    
//     const userWhatsApp = user[1];
    
//     // Obtener información del producto
//     const products = productsSheet.getDataRange().getValues();
//     let product = null;
    
//     for (let i = 1; i < products.length; i++) {
//       if (products[i][0] === productId && products[i][5] === true) {
//         product = products[i];
//         break;
//       }
//     }
    
//     if (!product) {
//       return { success: false, message: 'Producto no encontrado o no disponible' };
//     }
    
//     // Calcular precio según duración
//     let productPrice = 0;
//     switch(durationMonths) {
//       case 1:
//         productPrice = parseFloat(product[2]) || 0;
//         break;
//       case 2:
//         productPrice = parseFloat(product[3]) || 0;
//         break;
//       case 3:
//         productPrice = parseFloat(product[4]) || 0;
//         break;
//     }
    
//     if (productPrice <= 0) {
//       return { success: false, message: 'Precio no válido para la duración seleccionada' };
//     }
    
//     // Verificar balance
//     const userBalance = parseFloat(user[3]) || 0;
    
//     if (userBalance < productPrice) {
//       return { success: false, message: 'Saldo insuficiente' };
//     }
    
//     let licenseInfo = `Licencia ${product[1]} - ${durationMonths} mes(es)`;
    
//     // Crear fecha actual solo con día
//     const currentDate = new Date();
//     currentDate.setHours(0, 0, 0, 0);
    
//     // Si es "Licencia Software A", buscar perfil disponible y actualizar fechas
//     if (product[1] === 'Licencia Software A') {
//       const profileResult = findAvailableProfile();
      
//       if (!profileResult.success) {
//         return { success: false, message: profileResult.message };
//       }
      
//       // Calcular fechas
//       const startDate = currentDate;
//       const endDate = calculateEndDate(startDate, durationMonths);
      
//       // Actualizar la hoja perfiles
//       const perfilesSheet = getSheet('perfiles');
//       perfilesSheet.getRange(profileResult.data.rowIndex, 7).setValue(userWhatsApp);
//       perfilesSheet.getRange(profileResult.data.rowIndex, 8).setValue(startDate);
//       perfilesSheet.getRange(profileResult.data.rowIndex, 9).setValue(endDate);
      
//       licenseInfo = `${profileResult.data.resumen}\n\nDuración: ${durationMonths} mes(es)\nFecha inicio: ${startDate.toLocaleDateString('es-ES')}\nFecha vencimiento: ${endDate.toLocaleDateString('es-ES')}`;
//     }
    
//     // Crear pedido
//     const orderId = generateId();
//     const newOrder = [orderId, userId, productId, durationMonths, productPrice, 'completed', currentDate];
//     ordersSheet.appendRow(newOrder);
    
//     // Actualizar balance del usuario
//     const newBalance = userBalance - productPrice;
//     usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
    
//     return { 
//       success: true, 
//       message: 'Pedido creado exitosamente', 
//       data: {
//         orderId: orderId,
//         license: licenseInfo,
//         newBalance: newBalance,
//         duration: durationMonths
//       }
//     };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Buscar perfil disponible
// function findAvailableProfile() {
//   try {
//     const perfilesSheet = getSheet('perfiles');
    
//     if (perfilesSheet.getLastRow() <= 1) {
//       return { success: false, message: 'No hay perfiles configurados en el sistema' };
//     }
    
//     const profiles = perfilesSheet.getDataRange().getValues();
    
//     for (let i = 1; i < profiles.length; i++) {
//       const idWhatsApp = profiles[i][6];
      
//       if (!idWhatsApp || idWhatsApp === '' || idWhatsApp === null || idWhatsApp === undefined) {
//         return { 
//           success: true, 
//           data: {
//             rowIndex: i + 1,
//             profile: profiles[i],
//             resumen: profiles[i][5]
//           }
//         };
//       }
//     }
    
//     return { success: false, message: 'No hay perfiles disponibles en este momento' };
//   } catch (error) {
//     return { success: false, message: 'Error buscando perfiles: ' + error.message };
//   }
// }

// // Obtener perfiles del usuario
// function getUserProfiles(userWhatsApp) {
//   try {
//     if (!userWhatsApp) {
//       return { success: false, message: 'Número de WhatsApp requerido' };
//     }
    
//     const perfilesSheet = getSheet('perfiles');
    
//     if (perfilesSheet.getLastRow() <= 1) {
//       return { success: true, message: 'No hay perfiles', data: [] };
//     }
    
//     const profiles = perfilesSheet.getDataRange().getValues();
//     const userProfiles = [];
    
//     for (let i = 1; i < profiles.length; i++) {
//       const profileWhatsApp = profiles[i][6];
      
//       if (profileWhatsApp === userWhatsApp) {
//         let fechaInicio = profiles[i][7];
//         let fechaFinal = profiles[i][8];
        
//         // Convertir fechas si no son objetos Date
//         if (fechaInicio && !(fechaInicio instanceof Date)) {
//           fechaInicio = new Date(fechaInicio);
//         }
//         if (fechaFinal && !(fechaFinal instanceof Date)) {
//           fechaFinal = new Date(fechaFinal);
//         }
        
//         userProfiles.push({
//           rowIndex: i + 1,
//           idPerfil: profiles[i][0] || 'N/A',
//           idCuenta: profiles[i][1] || 'N/A',
//           plataforma: profiles[i][2] || 'N/A',
//           perfil: profiles[i][3] || 'N/A',
//           pin: profiles[i][4] || 'N/A',
//           resumen: profiles[i][5] || 'N/A',
//           idWhatsApp: profiles[i][6] || 'N/A',
//           fechaInicio: fechaInicio ? fechaInicio.toISOString() : null,
//           fechaFinal: fechaFinal ? fechaFinal.toISOString() : null
//         });
//       }
//     }
    
//     return { success: true, message: 'Perfiles obtenidos', data: userProfiles };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Renovar perfil existente
// function renewProfile(userWhatsApp, profileId, durationMonths) {
//   try {
//     if (!userWhatsApp || !profileId || !durationMonths) {
//       return { success: false, message: 'Datos incompletos' };
//     }
    
//     const duration = parseInt(durationMonths);
//     if (duration < 1 || duration > 3) {
//       return { success: false, message: 'Duración inválida. Debe ser 1, 2 o 3 meses' };
//     }
    
//     // Calcular precio según duración
//     let price = 0;
//     switch(duration) {
//       case 1: price = 29.99; break;
//       case 2: price = 54.99; break;
//       case 3: price = 79.99; break;
//     }
    
//     // Obtener usuario por WhatsApp
//     const usersSheet = getSheet('users');
//     const users = usersSheet.getDataRange().getValues();
//     let user = null;
//     let userRowIndex = -1;
    
//     for (let i = 1; i < users.length; i++) {
//       if (users[i][1] === userWhatsApp) {
//         user = users[i];
//         userRowIndex = i + 1;
//         break;
//       }
//     }
    
//     if (!user) {
//       return { success: false, message: 'Usuario no encontrado' };
//     }
    
//     // Verificar balance
//     const userBalance = parseFloat(user[3]) || 0;
//     if (userBalance < price) {
//       return { success: false, message: 'Saldo insuficiente' };
//     }
    
//     // Buscar el perfil específico
//     const perfilesSheet = getSheet('perfiles');
//     const profiles = perfilesSheet.getDataRange().getValues();
//     let targetProfile = null;
//     let profileRowIndex = -1;
    
//     for (let i = 1; i < profiles.length; i++) {
//       if (profiles[i][0] === profileId && profiles[i][6] === userWhatsApp) {
//         targetProfile = profiles[i];
//         profileRowIndex = i + 1;
//         break;
//       }
//     }
    
//     if (!targetProfile) {
//       return { success: false, message: 'Perfil no encontrado' };
//     }
    
//     // Calcular nueva fecha final
//     const currentDate = new Date();
//     currentDate.setHours(0, 0, 0, 0);
    
//     let newEndDate;
//     const existingEndDate = new Date(targetProfile[8]);
    
//     if (existingEndDate > currentDate) {
//       newEndDate = new Date(existingEndDate);
//       newEndDate.setMonth(newEndDate.getMonth() + duration);
//     } else {
//       newEndDate = new Date(currentDate);
//       newEndDate.setMonth(newEndDate.getMonth() + duration);
//       perfilesSheet.getRange(profileRowIndex, 8).setValue(currentDate);
//     }
    
//     newEndDate.setHours(0, 0, 0, 0);
    
//     // Actualizar fecha final en el perfil
//     perfilesSheet.getRange(profileRowIndex, 9).setValue(newEndDate);
    
//     // Crear registro de la renovación
//     const ordersSheet = getSheet('orders');
//     const orderId = generateId();
//     const renewalOrder = [orderId, user[0], 'RENEWAL_' + profileId, duration, price, 'completed', currentDate];
//     ordersSheet.appendRow(renewalOrder);
    
//     // Actualizar balance del usuario
//     const newBalance = userBalance - price;
//     usersSheet.getRange(userRowIndex, 4).setValue(newBalance);
    
//     return {
//       success: true,
//       message: 'Perfil renovado exitosamente',
//       data: {
//         newEndDate: newEndDate.toISOString(),
//         newBalance: newBalance
//       }
//     };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Limpiar perfiles vencidos
// function cleanExpiredProfiles() {
//   try {
//     const perfilesSheet = getSheet('perfiles');
//     const profiles = perfilesSheet.getDataRange().getValues();
    
//     const currentDate = new Date();
//     currentDate.setHours(0, 0, 0, 0);
    
//     let cleanedCount = 0;
    
//     for (let i = 1; i < profiles.length; i++) {
//       const fechaFinal = profiles[i][8];
//       const idWhatsApp = profiles[i][6];
      
//       if (fechaFinal && idWhatsApp && fechaFinal instanceof Date) {
//         if (fechaFinal < currentDate) {
//           perfilesSheet.getRange(i + 1, 7).setValue('');
//           perfilesSheet.getRange(i + 1, 8).setValue('');
//           perfilesSheet.getRange(i + 1, 9).setValue('');
//           cleanedCount++;
//         }
//       }
//     }
    
//     return { success: true, message: `${cleanedCount} perfiles vencidos liberados`, data: { cleanedCount } };
//   } catch (error) {
//     return { success: false, message: 'Error: ' + error.message };
//   }
// }

// // Calcular fecha final
// function calculateEndDate(startDate, durationMonths) {
//   const endDate = new Date(startDate);
//   endDate.setMonth(endDate.getMonth() + durationMonths);
//   endDate.setHours(0, 0, 0, 0);
//   return endDate;
// }

// // Generar ID único
// function generateId() {
//   return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
// }

// // Función para inicializar todas las hojas
// function initializeAllSheets() {
//   const usersSheet = getSheet('users');
//   const productsSheet = getSheet('products');
//   const ordersSheet = getSheet('orders');
//   const perfilesSheet = getSheet('perfiles');
  
//   // Agregar productos de ejemplo si la hoja está vacía
//   if (productsSheet.getLastRow() <= 1) {
//     const sampleProducts = [
//       [generateId(), 'Licencia Software A', 29.99, 54.99, 79.99, true],
//       [generateId(), 'Licencia Software B', 49.99, 89.99, 129.99, true],
//       [generateId(), 'Licencia Premium', 99.99, 179.99, 249.99, true]
//     ];
    
//     sampleProducts.forEach(product => {
//       productsSheet.appendRow(product);
//     });
//   }
  
//   console.log('Hojas inicializadas correctamente');
// }