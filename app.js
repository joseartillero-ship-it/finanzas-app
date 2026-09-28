// Configuración de Supabase
const SUPABASE_URL = 'https://tnbkrtczfthowhbush.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuYmtydGN6ZnRob3doYnVzaCIsInJvbGUiOiJhb24iLCJpYXQiOjE3NDEzMjQ5NTMsImV4cCI6MjA1NjkwMDk1M30.b3B1Xw6k1T_j4WvJ3WbV7Xb1w4a'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

// Actualizar barra de usuario y botones de login
async function actualizarUI() {
  const { data: { session } } = await supabaseClient.auth.getSession()
  const userEmail = document.getElementById('user-email')
  const authForms = document.getElementById('auth-forms')
  const btnLogout = document.getElementById('btn-logout')

  if (session) {
    if (userEmail) userEmail.textContent = `Sesión activa: ${session.user.email}`
    if (authForms) authForms.classList.add('hidden')
    if (btnLogout) btnLogout.classList.remove('hidden')
  } else {
    if (userEmail) userEmail.textContent = 'Inicia sesión o regístrate para guardar tus datos'
    if (authForms) authForms.classList.remove('hidden')
    if (btnLogout) btnLogout.classList.add('hidden')
  }
}

// Eventos Login / Registro / Logout
document.getElementById('btn-login')?.addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
  if (error) alert('Error al iniciar sesión: ' + error.message)
  else {
    actualizarUI()
    cargarCategorias()
    cargarTransaccionesBD()
    actualizarTotalesBD()
  }
})

document.getElementById('btn-signup')?.addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const { error } = await supabaseClient.auth.signUp({ email, password })
  if (error) alert('Error al registrarse: ' + error.message)
  else alert('¡Registro completado! Si se requiere confirmación, revisa tu correo.')
})

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut()
  actualizarUI()
  cargarCategorias()
  cargarTransaccionesBD()
  actualizarTotalesBD()
})

// Cargar Categorías
async function cargarCategorias() {
  const { data, error } = await supabaseClient
    .from('categorias')
    .select('*')
    .order('nombre')

  if (error) return console.error('Error cargando categorías:', error)

  const lista = document.getElementById('lista-categorias')
  const selectCategoria = document.getElementById('categoria-transaccion')

  if (lista) lista.innerHTML = ''
  if (selectCategoria) selectCategoria.innerHTML = '<option value="">Sin categoría</option>'

  data?.forEach((cat) => {
    if (lista) {
      const li = document.createElement('li')
      li.className = 'flex justify-between items-center p-2 bg-gray-50 rounded border text-sm'
      li.innerHTML = `
        <span class="text-gray-700">${cat.nombre}</span>
        <button onclick="eliminarCategoria('${cat.id}')" class="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 rounded text-xs hover:bg-red-50">✕</button>
      `
      lista.appendChild(li)
    }

    if (selectCategoria) {
      const option = document.createElement('option')
      option.value = cat.id
      option.textContent = cat.nombre
      selectCategoria.appendChild(option)
    }
  })
}

// Eliminar Categoría
window.eliminarCategoria = async (id) => {
  const { error } = await supabaseClient.from('categorias').delete().eq('id', id)
  if (error) {
    alert('No se pudo borrar la categoría: ' + error.message)
  } else {
    cargarCategorias()
  }
}

// Añadir Categoría
document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = document.getElementById('nombre-categoria')
  const nombre = input.value.trim()

  const { data: { user } } = await supabaseClient.auth.getUser()

  const { error } = await supabaseClient.from('categorias').insert({
    nombre,
    user_id: user ? user.id : null
  })

  if (error) alert('Error insertando categoría: ' + error.message)
  else {
    input.value = ''
    cargarCategorias()
  }
})

// Cargar Transacciones
async function cargarTransaccionesBD() {
  const { data, error } = await supabaseClient
    .from('transacciones')
    .select('*, categorias(nombre)')
    .order('created_at', { ascending: false })

  if (error) return console.error('Error cargando transacciones:', error)

  const lista = document.getElementById('lista-transacciones')
  if (!lista) return
  lista.innerHTML = ''

  if (!data || data.length === 0) {
    lista.innerHTML = '<li class="p-4 text-center text-gray-500 text-sm">No hay transacciones registradas</li>'
    return
  }

  data.forEach((t) => {
    const li = document.createElement('li')
    li.className = 'py-3 flex justify-between items-center border-b border-gray-100'
    const esIngreso = t.tipo === 'Ingreso'
    const color = esIngreso ? 'text-green-600' : 'text-red-600'
    const signo = esIngreso ? '+' : '-'
    const catNombre = t.categorias ? t.categorias.nombre : 'Sin categoría'

    li.innerHTML = `
      <div>
        <p class="font-medium text-gray-800 text-sm">${t.concepto}</p>
        <p class="text-xs text-gray-400">${catNombre}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-bold text-sm ${color}">${signo}${parseFloat(t.monto).toFixed(2)} €</span>
        <button onclick="eliminarTransaccion('${t.id}')" class="text-gray-400 hover:text-red-600 font-bold px-1 text-xs">✕</button>
      </div>
    `
    lista.appendChild(li)
  })
}

// Eliminar Transacción
window.eliminarTransaccion = async (id) => {
  const { error } = await supabaseClient.from('transacciones').delete().eq('id', id)
  if (error) console.error('Error eliminando transacción:', error)
  else {
    cargarTransaccionesBD()
    actualizarTotalesBD()
  }
}

// Guardar Transacción
document.getElementById('form-transaccion')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) {
    alert('Debes iniciar sesión con tu email y contraseña en la barra superior para guardar transacciones.')
    return
  }

  const concepto = document.getElementById('concepto-transaccion').value
  const monto = parseFloat(document.getElementById('monto-transaccion').value)
  const tipo = document.getElementById('tipo-transaccion').value
  const categoriaVal = document.getElementById('categoria-transaccion').value
  const categoria_id = categoriaVal !== '' ? categoriaVal : null

  const { error } = await supabaseClient.from('transacciones').insert({
    user_id: user.id,
    concepto,
    monto,
    tipo,
    categoria_id
  })

  if (error) {
    alert('Error al guardar la transacción: ' + error.message)
  } else {
    document.getElementById('form-transaccion').reset()
    cargarTransaccionesBD()
    actualizarTotalesBD()
  }
})

// Actualizar Totales (Ingresos, Gastos, Saldo)
async function actualizarTotalesBD() {
  const { data, error } = await supabaseClient.from('transacciones').select('monto, tipo')

  if (error) return console.error('Error al obtener totales:', error)

  let ingresos = 0
  let gastos = 0

  data?.forEach((t) => {
    const monto = parseFloat(t.monto) || 0
    if (t.tipo === 'Ingreso') ingresos += monto
    else if (t.tipo === 'Gasto') gastos += monto
  })

  const saldo = ingresos - gastos

  const totalIngresosEl = document.getElementById('total-ingresos')
  const totalGastosEl = document.getElementById('total-gastos')
  const saldoTotalEl = document.getElementById('saldo-total')

  if (totalIngresosEl) totalIngresosEl.textContent = `${ingresos.toFixed(2)} €`
  if (totalGastosEl) totalGastosEl.textContent = `${gastos.toFixed(2)} €`
  if (saldoTotalEl) saldoTotalEl.textContent = `${saldo.toFixed(2)} €`
}

// Escuchar cambios de autenticación
supabaseClient.auth.onAuthStateChange(() => {
  actualizarUI()
  cargarCategorias()
  cargarTransaccionesBD()
  actualizarTotalesBD()
})

// Carga inicial
actualizarUI()
cargarCategorias()
cargarTransaccionesBD()
actualizarTotalesBD()