// ==========================================
// LÓGICA GENERAL DE LA APLICACIÓN Y REPORTES PDF
// ==========================================

let rolActual = null; // Guardará 'admin' o 'comun'
let movimientos = JSON.parse(localStorage.getItem('diversamente_movimientos')) || [];

document.addEventListener('DOMContentLoaded', () => {
    aplicarConfiguraciones();
});

function aplicarConfiguraciones() {
    document.getElementById('app-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('login-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('app-subtitulo').textContent = CONFIGURACION.subtitulo;
    
    const header = document.getElementById('header-bar');
    header.className = `${CONFIGURACION.colorPrincipal} text-slate-800 shadow-md p-4`;

    if (CONFIGURACION.logoUrl) {
        const appLogo = document.getElementById('app-logo');
        const loginLogo = document.getElementById('login-logo');
        appLogo.src = CONFIGURACION.logoUrl;
        loginLogo.src = CONFIGURACION.logoUrl;
        appLogo.classList.remove('hidden');
        loginLogo.classList.remove('hidden');
    }
}

// Evalúa y calcula montos en fracciones, decimales o enteros
function evaluarMonto(expresion) {
    if (!expresion) return 0;
    let limpio = expresion.toString().replace(/[$]/g, '').replace(/\s+/g, '').replace(/,/g, '.');

    if (limpio.includes('/')) {
        const partes = limpio.split('/');
        if (partes.length === 2) {
            const num = parseFloat(partes[0]);
            const den = parseFloat(partes[1]);
            if (!isNaN(num) && !isNaN(den) && den !== 0) {
                return num / den;
            }
        }
    }

    const valor = parseFloat(limpio);
    return isNaN(valor) ? 0 : valor;
}

// Formateador oficial a Pesos Colombianos (COP)
function formatearCOP(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(monto);
}

// Generar y descargar recibo individual en PDF
function descargarFacturaPDF(idMovimiento) {
    const movimiento = movimientos.find(m => m.id === idMovimiento);
    if (!movimiento) return;

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Error: La librería PDF aún no se ha cargado. Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Banner Superior con color de la empresa (#b7e2e1)
    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 14);
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("COMPROBANTE DE PAGO / RECIBO DE SERVICIO", 14, 28);

    const numComprobante = movimiento.id.toString().slice(-6);
    doc.setFontSize(10);
    doc.text(`N° Recibo: REC-${numComprobante}`, 145, 18);
    doc.text(`Fecha: ${movimiento.fecha}`, 145, 26);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 38, 196, 38);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Detalle del Servicio:", 14, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Categoría: ${movimiento.categoria}`, 14, 56);
    doc.text(`Descripción: ${movimiento.descripcion}`, 14, 64);
    doc.text(`Usuario: ${movimiento.entidad}`, 14, 72);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 82, 182, 8, 'F');

    doc.setFont("helvetica", "bold");
    doc.text("Concepto", 18, 87.5);
    doc.text("Monto Pagado", 150, 87.5);

    doc.setFont("helvetica", "normal");
    doc.text(movimiento.descripcion, 18, 98);
    doc.text(formatearCOP(movimiento.monto), 150, 98);

    doc.line(14, 105, 196, 105);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL PAGO: ${formatearCOP(movimiento.monto)}`, 130, 116);

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("Centro Integral DiversaMente, acompañamos procesos, potenciamos capacidades.", 14, 140);

    doc.save(`Recibo_DiversaMente_REC-${numComprobante}.pdf`);
}

// Exportar Resumen General en PDF
function exportarResumenPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Error: La librería PDF aún no se ha cargado. Verifica tu conexión a internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 14);
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("INFORME Y RESUMEN GENERAL CONTABLE", 14, 28);

    const fechaHoy = new Date().toLocaleDateString('es-CO');
    doc.setFontSize(10);
    doc.text(`Fecha Emisión: ${fechaHoy}`, 145, 22);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 38, 196, 38);

    let ingresos = 0;
    let egresos = 0;

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += m.monto;
        if (m.tipo === 'egreso') egresos += m.monto;
    });

    const balance = ingresos - egresos;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumen Balances Generales:", 14, 48);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 52, 182, 16, 'F');

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(8, 145, 178); // Cyan Ingresos
    doc.text(`Total Ingresos: ${formatearCOP(ingresos)}`, 18, 62);

    doc.setTextColor(225, 29, 72); // Rojo Egresos
    doc.text(`Total Egresos: ${formatearCOP(egresos)}`, 80, 62);

    doc.setTextColor(79, 70, 229); // Índigo Balance
    doc.text(`Balance Neto: ${formatearCOP(balance)}`, 140, 62);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text("Detalle Histórico de Transacciones:", 14, 78);

    doc.setFillColor(226, 232, 240);
    doc.rect(14, 82, 182, 8, 'F');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("FECHA", 17, 87.5);
    doc.text("TIPO", 38, 87.5);
    doc.text("CATEGORÍA", 58, 87.5);
    doc.text("DESCRIPCIÓN / USUARIO", 100, 87.5);
    doc.text("MONTO (COP)", 165, 87.5);

    let y = 96;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    movimientos.forEach((m) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        const tipoTexto = m.tipo.toUpperCase();
        const descripcionCorta = m.descripcion.length > 22 ? m.descripcion.substring(0, 22) + '...' : m.descripcion;
        const entidadCorta = m.entidad !== 'N/A' ? ` (${m.entidad})` : '';

        doc.text(m.fecha, 17, y);
        
        if (m.tipo === 'ingreso') {
            doc.setTextColor(8, 145, 178); // Cyan
        } else {
            doc.setTextColor(225, 29, 72); // Rojo
        }
        doc.text(tipoTexto, 38, y);

        doc.setTextColor(30, 41, 59);
        doc.text(m.categoria.substring(0, 18), 58, y);
        doc.text(`${descripcionCorta}${entidadCorta}`.substring(0, 35), 100, y);
        
        doc.setFont("helvetica", "bold");
        doc.text(formatearCOP(m.monto), 165, y);
        doc.setFont("helvetica", "normal");

        doc.setDrawColor(241, 245, 249);
        doc.line(14, y + 2, 196, y + 2);

        y += 7;
    });

    doc.save(`Resumen_Contable_DiversaMente_${Date.now()}.pdf`);
}

// Control de Sesión
function iniciarSesion(rolSolicitado) {
    if (rolSolicitado === 'admin') {
        const clave = prompt("Ingresa la contraseña de Administrador:");
        if (clave !== CONFIGURACION.claveAdministrador) {
            alert("Contraseña de administrador incorrecta.");
            return;
        }
        rolActual = 'admin';
    } else {
        const clave = prompt("Ingresa la contraseña de Consulta:");
        if (clave !== CONFIGURACION.claveUsuarioComun) {
            alert("Contraseña de usuario incorrecta.");
            return;
        }
        rolActual = 'comun';
    }

    document.getElementById('modal-login').classList.add('hidden');
    ajustarPermisosPorRol();
    renderizarTablaYTotales();
}

function cerrarSesion() {
    rolActual = null;
    document.getElementById('modal-login').classList.remove('hidden');
}

function ajustarPermisosPorRol() {
    const badge = document.getElementById('badge-rol');
    const seccionFormulario = document.getElementById('seccion-formulario');
    const seccionTabla = document.getElementById('seccion-tabla');

    if (rolActual === 'admin') {
        badge.textContent = "Modo: Administrador";
        badge.className = "text-xs px-2.5 py-1 rounded-full bg-cyan-600 text-white font-semibold";
        seccionFormulario.classList.remove('hidden');
        seccionTabla.classList.remove('lg:col-span-3');
        seccionTabla.classList.add('lg:col-span-2');
    } else {
        badge.textContent = "Modo: Solo Lectura";
        badge.className = "text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-semibold";
        seccionFormulario.classList.add('hidden');
        seccionTabla.classList.remove('lg:col-span-2');
        seccionTabla.classList.add('lg:col-span-3');
    }
}

// Agregar Movimiento
document.getElementById('form-movimiento').addEventListener('submit', (e) => {
    e.preventDefault();

    if (rolActual !== 'admin') {
        alert("No tienes permisos para esta acción.");
        return;
    }

    const valorEntrada = document.getElementById('campo-monto').value;
    const montoCalculado = evaluarMonto(valorEntrada);

    if (montoCalculado <= 0) {
        alert("Por favor ingresa un monto válido mayor a 0.");
        return;
    }

    const nuevoMovimiento = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString('es-CO'),
        tipo: document.getElementById('campo-tipo').value,
        categoria: document.getElementById('campo-categoria').value,
        monto: montoCalculado,
        entidad: document.getElementById('campo-entidad').value || 'N/A',
        descripcion: document.getElementById('campo-descripcion').value
    };

    movimientos.push(nuevoMovimiento);
    guardarEnLocalStorage();
    document.getElementById('form-movimiento').reset();
    renderizarTablaYTotales();

    if (nuevoMovimiento.tipo === 'ingreso') {
        setTimeout(() => {
            if (confirm("¿Deseas descargar el recibo / factura en PDF de este ingreso?")) {
                descargarFacturaPDF(nuevoMovimiento.id);
            }
        }, 100);
    }
});

// Eliminar Movimiento
function eliminarMovimiento(id) {
    if (rolActual !== 'admin') {
        alert("Acción no permitida.");
        return;
    }

    if (confirm("¿Deseas eliminar este registro contable?")) {
        movimientos = movimientos.filter(m => m.id !== id);
        guardarEnLocalStorage();
        renderizarTablaYTotales();
    }
}

function guardarEnLocalStorage() {
    localStorage.setItem('diversamente_movimientos', JSON.stringify(movimientos));
}

// Renderizar tabla y totales
function renderizarTablaYTotales() {
    const cuerpoTabla = document.getElementById('tabla-cuerpo');
    cuerpoTabla.innerHTML = '';

    let ingresos = 0;
    let egresos = 0;

    movimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += m.monto;
        if (m.tipo === 'egreso') egresos += m.monto;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition";
        
        let columnaAcciones = `<span class="text-slate-400 text-xs">Lectura</span>`;

        if (rolActual === 'admin') {
            const btnPDF = m.tipo === 'ingreso' 
                ? `<button onclick="descargarFacturaPDF(${m.id})" class="text-cyan-700 hover:text-cyan-900 font-bold text-xs bg-cyan-50 px-2 py-1 rounded">PDF</button>` 
                : '';
            
            columnaAcciones = `
                <div class="flex items-center justify-center gap-2">
                    ${btnPDF}
                    <button onclick="eliminarMovimiento(${m.id})" class="text-rose-600 hover:text-rose-800 font-bold text-xs">Eliminar</button>
                </div>
            `;
        }

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
            <td class="p-3 text-right font-bold text-slate-800">${formatearCOP(m.monto)}</td>
            <td class="p-3 text-center columna-acciones">${columnaAcciones}</td>
        `;
        cuerpoTabla.appendChild(fila);
    });

    document.getElementById('total-ingresos').textContent = formatearCOP(ingresos);
    document.getElementById('total-egresos').textContent = formatearCOP(egresos);
    document.getElementById('balance-total').textContent = formatearCOP(ingresos - egresos);
}
