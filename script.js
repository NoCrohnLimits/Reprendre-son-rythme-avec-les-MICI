const { createClient } = window.supabase

const supabaseUrl = 'https://zykhmkqtfrgxbqrehfqz.supabase.co'
const supabaseKey = 'sb_publishable_6BNXl_zDU0zXNwSEC9VWoQ_nfi6LKLT'
const db = createClient(supabaseUrl, supabaseKey)

let recapLimit = 10;

function getEl(id) {
  return document.getElementById(id)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatFrenchDate(value) {
  if (!value) return 'Date inconnue'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue'
  }

  return date.toLocaleDateString('fr-FR')
}

function getTrackerValues() {
  return {
    energie: Number(getEl('energie')?.value || 1),
    fatigue: Number(getEl('fatigue')?.value || 1),
    symptomes: Number(getEl('symptomes')?.value || 1),
    urgence: Number(getEl('urgence')?.value || 1),
    moral: Number(getEl('moral')?.value || 1),
    notes: getEl('notes')?.value?.trim() || ''
  }
}

function getTrackerScore(values) {
  return values.energie + values.fatigue + values.symptomes + values.urgence + values.moral
}

function getTrackerColor(score) {
  if (score >= 18) return 'green'
  if (score >= 12) return 'orange'
  return 'red'
}

function getTrackerLabel(color) {
  if (color === 'green') return 'VERT'
  if (color === 'orange') return 'ORANGE'
  return 'ROUGE'
}

function getTrackerAdvice(score) {
  if (score >= 18) {
    return {
      title: 'Journée favorable',
      text: 'Activité conseillée : marche, vélo doux ou séance progressive.'
    }
  }

  if (score >= 12) {
    return {
      title: 'Journée prudente',
      text: 'Activité conseillée : marche tranquille, mobilité, respiration.'
    }
  }

  return {
    title: 'Journée difficile',
    text: 'Activité conseillée : repos ou mobilité très légère.'
  }
}

function computeAndRender() {
  const values = getTrackerValues()
  const score = getTrackerScore(values)
  const color = getTrackerColor(score)
  const advice = getTrackerAdvice(score)

  const resultBox = getEl('resultBox')
  const badge = getEl('badge')
  const resultText = getEl('resultText')
  const resultActivity = getEl('resultActivity')
  const lastScore = getEl('lastScore')

  if (resultBox) resultBox.className = `result ${color}`
  if (badge) badge.textContent = getTrackerLabel(color)
  if (resultText) resultText.textContent = `Score total : ${score} / 20 — ${advice.title}`
  if (resultActivity) resultActivity.textContent = advice.text
  if (lastScore) lastScore.textContent = String(score)
}

async function saveEntry() {
  const values = getTrackerValues()
  const score = getTrackerScore(values)
  const color = getTrackerColor(score)

  computeAndRender()

  const { data: authData } = await db.auth.getUser()
  const user = authData?.user ?? null

  if (!user) {
    alert('Tu dois être connecté pour enregistrer ton suivi du jour.')
    return
  }

  const payload = {
    energie: values.energie,
    fatigue: values.fatigue,
    symptomes: values.symptomes,
    urgence: values.urgence,
    moral: values.moral,
    notes: values.notes,
    score,
    color,
    user_id: user.id
  }

  const { data, error } = await db
    .from('daily_entries')
    .insert([payload])
    .select()

  console.log('daily insert data =', data)
  console.log('daily insert error =', error)

  if (error) {
    alert(error.message || 'Impossible d’enregistrer le suivi du jour.')
    return
  }

  alert('Suivi du jour enregistré avec succès.')
  await loadMonthlyRecap()
}

async function loadMonthlyRecap() {
  const countEntries = getEl('countEntries')
  const mDays = getEl('mDays')
  const mGreen = getEl('mGreen')
  const mOrange = getEl('mOrange')
  const mRed = getEl('mRed')
  const recapMeta = getEl('recapMeta')
  const historyList = getEl('historyList')
  const connectedState = getEl('connectedState')
  const authStatus = getEl('authStatus')

  const { data: authData } = await db.auth.getUser()
  const user = authData?.user ?? null

  if (connectedState) connectedState.textContent = user ? 'Oui' : 'Non'
  if (authStatus) authStatus.textContent = user ? `Connecté : ${user.email}` : 'Aucun compte connecté.'

  if (!user) {
    if (countEntries) countEntries.textContent = '0'
    if (mDays) mDays.textContent = '0'
    if (mGreen) mGreen.textContent = '0'
    if (mOrange) mOrange.textContent = '0'
    if (mRed) mRed.textContent = '0'
    if (recapMeta) recapMeta.innerHTML = '<span class="topic">Déconnecté</span>'
    if (historyList) {
      historyList.innerHTML = '<div class="forum-post"><h4>Connexion requise</h4><p>Connecte-toi pour voir ton suivi du jour.</p></div>'
    }
    window.__lastMonthlyEntries = []
    return
  }

  let query = db
    .from('daily_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .eq('user_id', user.id)

  const { data, error } = await query

  if (error) {
    if (historyList) {
      historyList.innerHTML = '<div class="forum-post"><h4>Erreur</h4><p>Impossible de charger le récap mensuel.</p></div>'
    }
    window.__lastMonthlyEntries = []
    return
  }

  const entries = data || []
  const now = new Date()

  const monthEntries = entries.filter(item => {
    const date = new Date(item.created_at)
    return (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  })

  window.__lastMonthlyEntries = monthEntries

  if (countEntries) countEntries.textContent = String(entries.length)
  if (mDays) mDays.textContent = String(monthEntries.length)
  if (mGreen) mGreen.textContent = String(monthEntries.filter(item => item.color === 'green').length)
  if (mOrange) mOrange.textContent = String(monthEntries.filter(item => item.color === 'orange').length)
  if (mRed) mRed.textContent = String(monthEntries.filter(item => item.color === 'red').length)

  if (recapMeta) {
    const average = monthEntries.length
      ? (monthEntries.reduce((sum, item) => sum + Number(item.score || 0), 0) / monthEntries.length).toFixed(1)
      : null

    recapMeta.innerHTML = `
      <span class="topic">${average ? `Moyenne : ${average} / 20` : 'Aucune donnée ce mois-ci'}</span>
      <span class="topic">Données du compte connecté</span>
      <span class="topic">Mise à jour automatique</span>
    `
  }

  if (!historyList) return

  if (!monthEntries.length) {
    historyList.innerHTML = '<div class="forum-post"><h4>Aucun suivi ce mois-ci</h4><p>Enregistre un jour pour remplir le récap.</p></div>'
    return
  }

  const visibleMonth = monthEntries.slice(0, recapLimit)

  const btn = document.querySelector('#recap .hero-actions .btn-primary')
if (btn) {
  btn.textContent = recapLimit >= monthEntries.length ? 'Réduire' : 'Afficher plus'
}

  historyList.innerHTML = visibleMonth.map(item => `
    <article class="forum-post">
      <h4>${formatFrenchDate(item.created_at)} — Score ${escapeHtml(item.score ?? 0)}/20</h4>
      <p>Couleur du jour : ${escapeHtml(getTrackerLabel(item.color || 'red'))}</p>
      <p>${escapeHtml(item.notes ?? '')}</p>
    </article>
  `).join('')
}

function toggleRecapLimit() {
  const total = window.__lastMonthlyEntries?.length || 0

  if (recapLimit >= total) {
    recapLimit = 10
  } else {
    recapLimit += 10
  }

  loadMonthlyRecap()

  const btn = document.querySelector('#recap .hero-actions .btn-primary')
  if (btn) {
    btn.textContent = recapLimit >= total ? 'Réduire' : 'Afficher plus'
  }
}

function downloadRecapPDF() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const now = new Date()
  const monthEntries = window.__lastMonthlyEntries || []

  doc.setFontSize(18)
  doc.text('NoCrohnLimits - Récap mensuel', 14, 16)
  doc.setFontSize(11)
  doc.text(`Mois : ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, 14, 24)

  let y = 36

  if (!monthEntries.length) {
    doc.text('Aucune donnée ce mois-ci.', 14, y)
  } else {
    monthEntries.forEach((e, i) => {
      const date = formatFrenchDate(e.created_at)
      const line1 = `${i + 1}. ${date} - Score ${e.score}/20 - ${(e.color || 'red').toUpperCase()}`
      const line2 = `Notes : ${e.notes || 'Aucune note'}`

      if (y > 270) {
        doc.addPage()
        y = 16
      }

      doc.text(line1, 14, y)
      y += 7

      const wrapped = doc.splitTextToSize(line2, 180)
      doc.text(wrapped, 14, y)
      y += wrapped.length * 6 + 4
    })
  }

  doc.save('recap-mensuel.pdf')
}

async function loadTestimonials() {
  const container = getEl('testimonials-list')

  if (!container) {
    console.error('Conteneur testimonials-list introuvable')
    return
  }

  container.innerHTML = '<p>Chargement des témoignages...</p>'

  const { data, error } = await db
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false })

  console.log('testimonials data =', data)
  console.log('testimonials error =', error)

  if (error) {
    container.innerHTML = '<p>Impossible de charger les témoignages.</p>'
    return
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>Aucun témoignage disponible pour le moment.</p>'
    return
  }

  container.innerHTML = data.map(item => `
    <article class="testimonial-card">
      <h4>${escapeHtml(item.name ?? 'Témoignage')}</h4>
      <p>${escapeHtml(item.message ?? '')}</p>
      <div class="testimonial-meta">
        ${escapeHtml(item.topic ?? 'Sans sujet')} · ${formatFrenchDate(item.created_at)}
      </div>
    </article>
  `).join('')
}

async function publishTestimonial() {
  const pseudoInput = getEl('pseudo')
  const topicInput = getEl('topicSelect')
  const messageInput = getEl('forumMessage')

  const pseudo = pseudoInput?.value?.trim() || 'Membre'
  const topic = topicInput?.value?.trim() || 'Témoignage'
  const message = messageInput?.value?.trim() || ''

  if (!message) {
    alert('Écris un témoignage avant de publier.')
    return
  }

  const payload = {
    name: pseudo,
    topic,
    message
  }

  const { data, error } = await db
    .from('testimonials')
    .insert([payload])
    .select()

  console.log('testimonial insert data =', data)
  console.log('testimonial insert error =', error)

  if (error) {
    alert(error.message || 'Impossible de publier le témoignage.')
    return
  }

  if (messageInput) messageInput.value = ''
  if (topicInput) topicInput.selectedIndex = 0
  if (pseudoInput) pseudoInput.value = ''

  alert('Témoignage publié avec succès.')
  await loadTestimonials()
}

async function loadHelpRequests() {
  const container = getEl('help-requests-list')

  if (!container) {
    console.error('Conteneur help-requests-list introuvable')
    return
  }

  container.innerHTML = '<p>Chargement des demandes...</p>'

  const { data, error } = await db
    .from('help_requests')
    .select(`
      id,
      name,
      topic,
      message,
      status,
      created_at,
      help_replies (
        id,
        name,
        message,
        created_at
      )
    `)
    .order('created_at', { ascending: false })

  console.log('help data =', data)
  console.log('help error =', error)

  if (error) {
    container.innerHTML = '<p>Impossible de charger les demandes d’entraide.</p>'
    return
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>Aucune demande publiée pour le moment.</p>'
    return
  }

  container.innerHTML = data.map(item => `
    <article class="help-card">
      <h4>${escapeHtml(item.name ?? 'Membre')}</h4>
      <p>${escapeHtml(item.message ?? '')}</p>
      <div class="help-meta">
        <span>${escapeHtml(item.topic ?? 'Sans sujet')}</span>
        <span>·</span>
        <span>${formatFrenchDate(item.created_at)}</span>
        <span class="help-status">${escapeHtml(item.status ?? 'Ouvert')}</span>
      </div>

      <div class="hero-actions" style="margin-top:1rem;margin-bottom:0;">
        ${
          item.status !== 'Résolu'
            ? `
              <button class="btn btn-secondary" type="button" onclick="markHelpRequestResolved(${item.id})">
                Marquer comme résolu
              </button>
            `
            : `
              <span class="topic">Demande résolue</span>
            `
        }
      </div>

      <div style="margin-top:16px;">
        <h5 style="margin:0 0 10px;">
          Réponses (${item.help_replies?.length || 0})
        </h5>
        ${
          item.help_replies && item.help_replies.length > 0
            ? item.help_replies.map(reply => `
              <div class="forum-post" style="margin-top:10px;">
                <h4 style="font-size:16px;">${escapeHtml(reply.name ?? 'Membre')}</h4>
                <p>${escapeHtml(reply.message ?? '')}</p>
                <p style="margin-top:8px;font-size:13px;color:#655a72;">
                  ${formatFrenchDate(reply.created_at)}
                </p>
              </div>
            `).join('')
            : '<p class="microcopy">Aucune réponse pour le moment.</p>'
        }
      </div>

      <div style="margin-top:16px;">
        <div class="field-grid">
          <div class="field">
            <label for="replyName-${item.id}">Pseudo</label>
            <input id="replyName-${item.id}" type="text" placeholder="Ton pseudo">
          </div>
          <div class="field full">
            <label for="replyMessage-${item.id}">Réponse</label>
            <textarea id="replyMessage-${item.id}" placeholder="Écris une réponse utile et bienveillante..."></textarea>
          </div>
        </div>
        <div class="hero-actions" style="margin-top:1rem;margin-bottom:0;">
          <button class="btn btn-secondary" type="button" onclick="publishHelpReply(${item.id})">
            Répondre
          </button>
        </div>
      </div>
    </article>
  `).join('')
}

async function publishHelpRequest() {
  const pseudoInput = getEl('helpPseudo')
  const topicInput = getEl('helpTopic')
  const messageInput = getEl('helpMessage')

  const pseudo = pseudoInput?.value?.trim() || 'Membre'
  const topic = topicInput?.value?.trim() || 'Demande'
  const message = messageInput?.value?.trim() || ''

  if (!message) {
    alert('Écris une demande avant de publier.')
    return
  }

  const payload = {
    name: pseudo,
    topic,
    message,
    status: 'Ouvert'
  }

  const { data, error } = await db
    .from('help_requests')
    .insert([payload])
    .select()

  console.log('help insert data =', data)
  console.log('help insert error =', error)

  if (error) {
    alert(error.message || 'Impossible de publier la demande d’entraide.')
    return
  }

  if (messageInput) messageInput.value = ''
  if (topicInput) topicInput.selectedIndex = 0
  if (pseudoInput) pseudoInput.value = ''

  alert('Demande d’entraide publiée avec succès.')
  await loadHelpRequests()
}

async function publishHelpReply(requestId) {
  const nameInput = getEl(`replyName-${requestId}`)
  const messageInput = getEl(`replyMessage-${requestId}`)

  const name = nameInput?.value?.trim() || 'Membre'
  const message = messageInput?.value?.trim() || ''

  if (!message) {
    alert('Écris une réponse avant de publier.')
    return
  }

  const payload = {
    request_id: requestId,
    name,
    message
  }

  const { data, error } = await db
    .from('help_replies')
    .insert([payload])
    .select()

  console.log('reply insert data =', data)
  console.log('reply insert error =', error)

  if (error) {
    alert(error.message || 'Impossible de publier la réponse.')
    return
  }

  if (messageInput) messageInput.value = ''
  if (nameInput) nameInput.value = ''

  alert('Réponse publiée avec succès.')
  await loadHelpRequests()
}

async function markHelpRequestResolved(requestId) {
  const { data, error } = await db
    .from('help_requests')
    .update({ status: 'Résolu' })
    .eq('id', requestId)
    .select()

  console.log('resolve data =', data)
  console.log('resolve error =', error)

  if (error) {
    alert(error.message || 'Impossible de marquer la demande comme résolue.')
    return
  }

  alert('Demande marquée comme résolue.')
  await loadHelpRequests()
}

async function signUpUser() {
  const emailInput = getEl('signupEmail')
  const passwordInput = getEl('signupPassword')

  const email = emailInput?.value?.trim() || ''
  const password = passwordInput?.value || ''

  if (!email || !password) {
    alert('Entre un email et un mot de passe.')
    return
  }

  const { data, error } = await db.auth.signUp({
    email,
    password
  })

  console.log('signup data =', data)
  console.log('signup error =', error)

  if (error) {
    alert(error.message || 'Impossible de créer le compte.')
    return
  }

  if (emailInput) emailInput.value = ''
  if (passwordInput) passwordInput.value = ''

  alert('Compte créé avec succès.')
  await refreshAuthState()
}

async function signInUser() {
  const emailInput = getEl('loginEmail')
  const passwordInput = getEl('loginPassword')

  const email = emailInput?.value?.trim() || ''
  const password = passwordInput?.value || ''

  if (!email || !password) {
    alert('Entre ton email et ton mot de passe.')
    return
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  })

  console.log('signin data =', data)
  console.log('signin error =', error)

  if (error) {
    alert(error.message || 'Impossible de se connecter.')
    return
  }

  if (passwordInput) passwordInput.value = ''

  alert('Connexion réussie.')
  await refreshAuthState()
  await loadMonthlyRecap()
}
async function signOutUser() {
  const { error } = await db.auth.signOut()

  if (error) {
    alert(error.message || 'Impossible de se déconnecter.')
    return
  }

  await refreshAuthState()
  await loadMonthlyRecap()
}
function updateAuthUI(user) {
  const authForms = getEl('authForms')
  const loggedInActions = getEl('loggedInActions')
  const authStatus = getEl('authStatus')

  if (authForms) authForms.classList.toggle('hidden', !!user)
  if (loggedInActions) loggedInActions.classList.toggle('hidden', !user)

  if (authStatus) {
    authStatus.textContent = user
      ? `Connecté : ${user.email}`
      : 'Aucun compte connecté.'
  }
}
async function refreshAuthState() {
  const { data, error } = await db.auth.getUser()
  const user = data?.user ?? null

  console.log('auth user data =', data)
  console.log('auth user error =', error)

  updateAuthUI(user)
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'))

      button.classList.add('active')

      const targetId = `tab-${button.dataset.tab}`
      const target = getEl(targetId)

      if (target) {
        target.classList.add('active')
      }
    })
  })
}

async function initApp() {
  initTabs()
  bindScrollHeader()
  computeAndRender()
  setupAuthListener()
  await refreshAuthState()
  await loadMonthlyRecap()
  await loadTestimonials()
  await loadHelpRequests()
}

function setupAuthListener() {
  db.auth.onAuthStateChange(() => {
    setTimeout(async () => {
      await refreshAuthState()
      await loadMonthlyRecap()
    }, 0)
  })
}

window.computeAndRender = computeAndRender
window.saveEntry = saveEntry
window.publishTestimonial = publishTestimonial
window.publishHelpRequest = publishHelpRequest
window.publishHelpReply = publishHelpReply
window.markHelpRequestResolved = markHelpRequestResolved
window.signUpUser = signUpUser
window.signInUser = signInUser
window.signOutUser = signOutUser

function bindScrollHeader() {
  const header = document.getElementById('topBanner')
  if (!header) return

  let lastY = window.scrollY

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY

    if (currentY > lastY && currentY > 20) {
      header.classList.add('hide')
    } else {
      header.classList.remove('hide')
    }

    lastY = currentY
  }, { passive: true })
}
initApp()
