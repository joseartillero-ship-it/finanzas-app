// Supabase Configuration
const SUPABASE_URL = 'https://eqkkrcjdzdlhzwdnunoh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0pfomhywrBLPzaDVJ927HQ_TGTqRNfD';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Update user bar and auth buttons
async function actualizarUI() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const userEmail = document.getElementById('user-email');
    const authForms = document.getElementById('auth-forms');
    const btnLogout = document.getElementById('btn-logout');

    if (session) {
        if (userEmail) userEmail.textContent = `Active session: ${session.user.email}`;
        if (authForms) authForms.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
    } else {
        if (userEmail) userEmail.textContent = 'Sign in or register to save your data';
        if (authForms) authForms.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
    }
}

// Login / Signup Events
document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert('Error signing in: ' + error.message);
    else {
        actualizarUI();
        cargarCategorias();
        cargarTransaccionesBD();
        actualizarTotalesBD();
        renderizarGraficoGastos();
    }
});

document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) alert('Error registering: ' + error.message);
    else alert('Registration complete! If confirmation is required, please check your email.');
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    actualizarUI();
    cargarCategorias();
    cargarTransaccionesBD();
    actualizarTotalesBD();
    renderizarGraficoGastos();
});

// Load Categories
async function cargarCategorias() {
    const { data, error } = await supabaseClient
        .from('categorias')
        .select('*')
        .order('nombre');

    if (error) return console.error('Error loading categories:', error);

    const lista = document.getElementById('lista-categorias');
    const selectCategoria = document.getElementById('categoria-transaccion');

    if (lista) lista.innerHTML = '';
    if (selectCategoria) selectCategoria.innerHTML = '<option value="">No category</option>';

    data?.forEach((cat) => {
        if (lista) {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-2 bg-gray-50 rounded border text-sm';
            li.innerHTML = `
                <span class="text-gray-700">${escaparHTML(cat.nombre)}</span>
                <button onclick="eliminarCategoria('${cat.id}')" class="text-red-500 hover:text-red-700 font-bold">Delete</button>
            `;
            lista.appendChild(li);
        }

        if (selectCategoria) {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            selectCategoria.appendChild(option);
        }
    });
}

// Delete Category
window.eliminarCategoria = async (id) => {
    const { error } = await supabaseClient.from('categorias').delete().eq('id', id);
    if (error) {
        alert('Could not delete category: ' + error.message);
    } else {
        cargarCategorias();
    }
};

// Add Category
document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('nombre-categoria');
    const nombre = input.value.trim();

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('categorias').insert({
        nombre,
        user_id: user ? user.id : null
    });

    if (error) alert('Error inserting category: ' + error.message);
    else {
        input.value = '';
        cargarCategorias();
    }
});
// Escape user text before inserting it into HTML (prevents XSS)
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}
// Load Transactions
async function cargarTransaccionesBD() {
    const lista = document.getElementById('lista-transacciones');
    if (!lista) return;
    lista.innerHTML = '';

    const { data, error } = await supabaseClient
        .from('transacciones')
        .select('*, categorias(nombre)')
        .order('fecha', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) return console.error('Error loading transactions:', error);
    
    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="p-4 text-center text-gray-500 text-sm">No transactions recorded yet.</p>';
        return;
    }

    data.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center border-b border-gray-100';
        const esIngreso = t.tipo === 'Ingreso';
        const color = esIngreso ? 'text-green-600' : 'text-red-600';
        const signo = esIngreso ? '+' : '-';
        const catNombre = t.categorias ? t.categorias.nombre : 'No category';
        const fechaTransaccion = t.fecha ? new Date(t.fecha).toLocaleDateString() : '';

        li.innerHTML = `
            <div>
                <p class="font-medium text-gray-800 text-sm">${escaparHTML(t.concepto)}</p>
                <p class="text-xs text-gray-400">${escaparHTML(catNombre)} <span class="ml-2 text-gray-300">${fechaTransaccion}</span></p>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-bold text-sm ${color}">${signo}${Number(t.monto).toFixed(2)} $</span>
                <button onclick="eliminarTransaccion('${t.id}')" class="text-gray-400 hover:text-red-600 text-sm">🗑️</button>
            </div>
        `;
        lista.appendChild(li);
    });
}
// Delete Transaction
window.eliminarTransaccion = async (id) => {
    const { error } = await supabaseClient.from('transacciones').delete().eq('id', id);
    if (error) console.error('Error deleting transaction:', error);
    else {
        cargarTransaccionesBD();
        actualizarTotalesBD();
        renderizarGraficoGastos();
    }
};

// Save Transaction
document.getElementById('form-transaccion')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert('You must sign in with your email and password in the top bar to save transactions.');
        return;
    }

    const concepto = document.getElementById('concepto-transaccion').value;
    const monto = parseFloat(document.getElementById('monto-transaccion').value);
    const tipo = document.getElementById('tipo-transaccion').value;
    const categoria_id = document.getElementById('categoria-transaccion').value || null;
    const fecha = document.getElementById('fecha-transaccion').value;

    const { error } = await supabaseClient.from('transacciones').insert({
        concepto,
        monto,
        tipo,
        categoria_id,
        fecha,
        user_id: user.id
    });

    if (error) {
        alert('Error saving transaction: ' + error.message);
    } else {
        e.target.reset();
        cargarTransaccionesBD();
        actualizarTotalesBD();
        renderizarGraficoGastos();
    }
});

// Update Totals (Income, Expenses, Balance)
async function actualizarTotalesBD() {
    const { data, error } = await supabaseClient.from('transacciones').select('monto, tipo');
    if (error) return console.error('Error fetching totals:', error);

    let ingresos = 0;
    let gastos = 0;

    data?.forEach((t) => {
        const monto = parseFloat(t.monto) || 0;
        if (t.tipo === 'Ingreso') ingresos += monto;
        else if (t.tipo === 'Gasto') gastos += monto;
    });

    const saldo = ingresos - gastos;

    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const saldoTotalEl = document.getElementById('saldo-total');

    if (totalIngresosEl) totalIngresosEl.textContent = `${Number(ingresos).toFixed(2)} $`;
    if (totalGastosEl) totalGastosEl.textContent = `${Number(gastos).toFixed(2)} $`;
    if (saldoTotalEl) saldoTotalEl.textContent = `${Number(saldo).toFixed(2)} $`;
}

// Listen to Auth State Changes
supabaseClient.auth.onAuthStateChange(() => {
    actualizarUI();
    cargarCategorias();
    cargarTransaccionesBD();
    actualizarTotalesBD();
    renderizarGraficoGastos();
});

// Initial Load
actualizarUI();
cargarCategorias();
cargarTransaccionesBD();
actualizarTotalesBD();

// Render Expense Chart (Chart.js)

async function renderizarGraficoGastos() {
    const { data, error } = await supabaseClient
        .from('resumen_por_categoria')
        .select('categoria, total_gastado')
        .order('total_gastado', { ascending: false });

    if (error) {
        console.error('Error loading chart data:', error);
        return;
    }

    const labels = data.map(d => d.categoria);
    const valores = data.map(d => Number(d.total_gastado));

    const palette = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];
    const backgroundColors = labels.map((_, i) => palette[i % palette.length]);

    const canvas = document.getElementById('graficogastos');
    if (!canvas) return;

    const chartInstance = Chart.getChart(canvas);
    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: valores,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}