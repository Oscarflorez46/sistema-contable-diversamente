// Map de correos y sus roles autorizados
const ROLES_POR_CORREO = {
    "oscarflorez64@gmail.com": "contador",        // Tu correo (Contador - Permisos totales)
    "centrointegraldiversamente9@gmail.com": "administrador",
    "juliandmc04@gmail.com": "administrador",     // Correo del Administrador
    "yulianagh0520@gmail.com": "usuario",         // Correo del Usuario Estándar
    "mafe919@hotmail.com": "usuario",
    "daira.fono@gmail.com": "usuario"

};

let usuarioRol = 'usuario'; // Rol por defecto

// ==========================================
// CONEXIÓN CON SUPABASE & LÓGICA DE NEGOCIO
// ==========================================

let dbSupabase = null;
let movimientosGlobales = [];
let movimientosFiltrados = [];

document.addEventListener('DOMContentLoaded', async () => {
    aplicarConfiguraciones();

    // Inicialización con validación de seguridad
    if (window.supabase && window.supabase.createClient) {
        dbSupabase = window.supabase.createClient(CONFIGURACION.supabaseUrl, CONFIGURACION.supabaseAnonKey);
        await verificarSesion();
    } else {
        alert("Error de conexión: No se pudo cargar la librería de Supabase. Revisa tu conexión a internet.");
    }

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!dbSupabase) {
            alert("El servicio de base de datos no está listo.");
            return;
        }

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const btnSubmit = document.getElementById('btn-login-submit');

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Verificando...";

        try {
            const { data, error } = await dbSupabase.auth.signInWithPassword({ email, password });

            if (error) {
                alert("Error de autenticación: " + error.message);
            } else {
                await verificarSesion();
            }
        } catch (err) {
            alert("Error al intentar iniciar sesión: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Iniciar Sesión";
        }
    });
});

function aplicarConfiguraciones() {
    document.getElementById('app-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('login-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('app-subtitulo').textContent = CONFIGURACION.subtitulo;

    if (CONFIGURACION.logoUrl) {
        document.getElementById('app-logo').src = CONFIGURACION.logoUrl;
        document.getElementById('login-logo').src = CONFIGURACION.logoUrl;
        document.getElementById('app-logo').classList.remove('hidden');
        document.getElementById('login-logo').classList.remove('hidden');
    }
}

async function verificarSesion() {
    if (!dbSupabase) return;

    const { data: { session } } = await dbSupabase.auth.getSession();

    if (session) {
        document.getElementById('modal-login').classList.add('hidden');
        
        const correo = session.user.email;

        // 1. Asignar el rol según el correo autenticado
        usuarioRol = ROLES_POR_CORREO[correo] || 'usuario';

        // 2. Actualizar la etiqueta (badge) de rol en la interfaz
        const badge = document.getElementById('badge-rol');
        if (badge) {
            badge.textContent = `${correo} (${usuarioRol.toUpperCase()})`;
            
            if (usuarioRol === 'contador') {
                badge.className = "text-xs px-2.5 py-1 rounded-full bg-emerald-700 text-white font-semibold";
            } else if (usuarioRol === 'administrador') {
                badge.className = "text-xs px-2.5 py-1 rounded-full bg-indigo-700 text-white font-semibold";
            } else {
                badge.className = "text-xs px-2.5 py-1 rounded-full bg-slate-600 text-white font-semibold";
            }
        }

        // 3. Controlar visibilidad del formulario (Solo 'contador' y 'administrador' pueden registrar)
        const formContenedor = document.getElementById('seccion-formulario');
        if (formContenedor) {
            if (usuarioRol === 'contador' || usuarioRol === 'administrador') {
                formContenedor.style.display = 'block';
            } else {
                formContenedor.style.display = 'none'; // El usuario estándar no ve el formulario
            }
        }

        await cargarDesdeSupabase();
    } else {
        document.getElementById('modal-login').classList.remove('hidden');
        const badge = document.getElementById('badge-rol');
        if (badge) {
            badge.textContent = "Desconectado";
            badge.className = "text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-semibold";
        }
    }
}

async function cerrarSesion() {
    if (dbSupabase) await dbSupabase.auth.signOut();
    location.reload();
}

async function cargarDesdeSupabase() {
    if (!dbSupabase) return;

    const { data, error } = await dbSupabase
        .from('transacciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al obtener transacciones:", error);
        return;
    }

    movimientosGlobales = data || [];
    cambiarFiltroFecha();
}

function cambiarFiltroFecha() {
    const opcion = document.getElementById('filtro-rango').value;
    const hoyStr = new Date().toISOString().split('T')[0];
    const mesActualStr = hoyStr.substring(0, 7);

    if (opcion === 'hoy') {
        movimientosFiltrados = movimientosGlobales.filter(m => m.fecha === hoyStr);
    } else if (opcion === 'mes') {
        movimientosFiltrados = movimientosGlobales.filter(m => m.fecha && m.fecha.startsWith(mesActualStr));
    } else {
        movimientosFiltrados = [...movimientosGlobales];
    }

    renderizarTablaYTotales();
}

function formatearCOP(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(monto);
}

document.getElementById('form-movimiento').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!dbSupabase) return alert("Base de datos no conectada.");

    const montoVal = parseFloat(document.getElementById('campo-monto').value.replace(/[$.,]/g, ''));
    if (isNaN(montoVal) || montoVal <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    const nuevoRegistro = {
        fecha: new Date().toISOString().split('T')[0],
        tipo: document.getElementById('campo-tipo').value,
        categoria: document.getElementById('campo-categoria').value,
        monto: montoVal,
        entidad: document.getElementById('campo-entidad').value || 'N/A',
        descripcion: document.getElementById('campo-descripcion').value
    };

    const { data, error } = await dbSupabase
        .from('transacciones')
        .insert([nuevoRegistro])
        .select();

    if (error) {
        alert("Error al guardar en la nube: " + error.message);
    } else {
        document.getElementById('form-movimiento').reset();
        await cargarDesdeSupabase();

        if (nuevoRegistro.tipo === 'ingreso' && data && data[0]) {
            setTimeout(() => {
                if (confirm("¿Deseas descargar el recibo individual en PDF?")) {
                    descargarFacturaPDF(data[0]);
                }
            }, 100);
        }
    }
});

async function eliminarMovimiento(id) {
    if (!dbSupabase) {
        console.error("Conexión a Supabase no inicializada.");
        return;
    }

    // Aseguramos la confirmación del usuario
    const respuesta = window.confirm("¿Deseas eliminar este registro contable de la base de datos?");
    if (!respuesta) return;

    try {
        const { error } = await dbSupabase
            .from('transacciones')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Recargar datos en la interfaz tras eliminar exitosamente
        if (typeof cargarDesdeSupabase === 'function') {
            await cargarDesdeSupabase();
        }
        
    } catch (err) {
        console.error("Error al eliminar el movimiento:", err);
        alert("No se pudo eliminar el registro: " + (err.message || err));
    }
}

function renderizarTablaYTotales() {
    const cuerpoTabla = document.getElementById('tabla-cuerpo');
    if (!cuerpoTabla) return;
    
    cuerpoTabla.innerHTML = '';

    let ingresos = 0;
    let egresos = 0;

    movimientosFiltrados.forEach(m => {
        const montoNum = parseFloat(m.monto) || 0;
        if (m.tipo === 'ingreso') ingresos += montoNum;
        if (m.tipo === 'egreso') egresos += montoNum;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition";

        // PERMISO 1: Descargar Recibos PDF (Contador y Administrador)
        const puedeDescargarPDF = (usuarioRol === 'contador' || usuarioRol === 'administrador') && m.tipo === 'ingreso';
        const btnPDF = puedeDescargarPDF
            ? `<button onclick='descargarFacturaPDF(${JSON.stringify(m)})' class="text-cyan-700 hover:text-cyan-900 font-bold text-xs bg-cyan-50 px-2 py-1 rounded">PDF</button>` 
            : '';

        // PERMISO 2: Eliminar Transacciones (Exclusivo para Contador)
        const btnEliminar = (usuarioRol === 'contador')
            ? `<button onclick="eliminarMovimiento(${m.id})" class="text-rose-600 hover:text-rose-800 font-bold text-xs">Eliminar</button>`
            : '<span class="text-xs text-slate-300">N/A</span>';

        fila.innerHTML = `
            <td class="p-3 text-xs text-slate-500">${m.fecha}</td>
            <td class="p-3 font-semibold ${m.tipo === 'ingreso' ? 'text-cyan-600' : 'text-rose-600'}">
                ${m.tipo.toUpperCase()}
            </td>
            <td class="p-3 text-xs font-medium">${m.categoria}</td>
            <td class="p-3">
                <p class="font-medium text-xs">${m.descripcion}</p>
                ${m.entidad !== 'N/A' ? `<p class="text-xs text-indigo-500 font-medium">Ref: ${m.entidad}</p>` : ''}
            </td>
            <td class="p-3 text-right font-bold text-slate-800">${formatearCOP(montoNum)}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${btnPDF}
                    ${btnEliminar}
                </div>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });

    document.getElementById('total-ingresos').textContent = formatearCOP(ingresos);
    document.getElementById('total-egresos').textContent = formatearCOP(egresos);
    document.getElementById('balance-total').textContent = formatearCOP(ingresos - egresos);
}

function descargarFacturaPDF(movimiento) {
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("Error cargando librería PDF.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);
    doc.text("COMPROBANTE DE PAGO / RECIBO DE SERVICIO", 14, 28);

    const numComprobante = movimiento.id.toString().padStart(6, '0');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`N° Recibo: REC-${numComprobante}`, 145, 18);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${movimiento.fecha}`, 145, 26);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 40, 196, 40);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Detalle del Servicio Atendido:", 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Categoría: ${movimiento.categoria}`, 14, 58);
    doc.text(`Descripción: ${movimiento.descripcion}`, 14, 66);
    doc.text(`Usuario / Remitente: ${movimiento.entidad}`, 14, 74);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 84, 182, 8, 'F');

    doc.setFont("helvetica", "bold");
    doc.text("Concepto", 18, 89.5);
    doc.text("Monto Pagado", 150, 89.5);

    doc.setFont("helvetica", "normal");
    doc.text(movimiento.descripcion, 18, 100);
    doc.text(formatearCOP(movimiento.monto), 150, 100);

    doc.line(14, 107, 196, 107);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL PAGO: ${formatearCOP(movimiento.monto)}`, 130, 118);

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("Gracias por confiar en el Centro Integral DiversaMente.", 14, 142);

    doc.save(`Recibo_DiversaMente_REC-${numComprobante}.pdf`);
}

function exportarResumenPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("Error cargando librería PDF.");
    if (movimientosFiltrados.length === 0) return alert("No hay movimientos en el rango seleccionado.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);

    const rangoSel = document.getElementById('filtro-rango').selectedOptions[0].text;
    doc.text(`RESUMEN CONTABLE - Rango: ${rangoSel}`, 14, 28);

    doc.text(`Emisión: ${new Date().toLocaleDateString('es-CO')}`, 145, 22);
    doc.line(14, 40, 196, 40);

    let ingresos = 0;
    let egresos = 0;
    movimientosFiltrados.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += parseFloat(m.monto);
        if (m.tipo === 'egreso') egresos += parseFloat(m.monto);
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Totales del Periodo Filtrado:", 14, 50);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 54, 182, 16, 'F');

    doc.setFontSize(9);
    doc.setTextColor(8, 145, 178);
    doc.text(`Ingresos: ${formatearCOP(ingresos)}`, 18, 64);

    doc.setTextColor(225, 29, 72);
    doc.text(`Egresos: ${formatearCOP(egresos)}`, 80, 64);

    doc.setTextColor(79, 70, 229);
    doc.text(`Balance: ${formatearCOP(ingresos - egresos)}`, 140, 64);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text("Detalle de Transacciones:", 14, 80);

    doc.setFillColor(226, 232, 240);
    doc.rect(14, 84, 182, 8, 'F');
    doc.setFontSize(8);
    doc.text("FECHA", 17, 89.5);
    doc.text("TIPO", 38, 89.5);
    doc.text("CATEGORÍA", 58, 89.5);
    doc.text("DESCRIPCIÓN / USUARIO", 100, 89.5);
    doc.text("MONTO", 165, 89.5);

    let y = 98;
    doc.setFont("helvetica", "normal");

    movimientosFiltrados.forEach((m) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        doc.text(m.fecha, 17, y);
        doc.setTextColor(m.tipo === 'ingreso' ? 8 : 225, m.tipo === 'ingreso' ? 145 : 29, m.tipo === 'ingreso' ? 178 : 72);
        doc.text(m.tipo.toUpperCase(), 38, y);

        doc.setTextColor(30, 41, 59);
        doc.text(m.categoria.substring(0, 18), 58, y);
        doc.text(`${m.descripcion} (${m.entidad})`.substring(0, 32), 100, y);
        doc.text(formatearCOP(m.monto), 165, y);

        y += 7;
    });

    doc.save(`Resumen_Contable_${rangoSel.replace(/\s+/g, '_')}.pdf`);
}