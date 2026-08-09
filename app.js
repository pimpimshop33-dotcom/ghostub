// ── Auth différée — helpers ────────────────────────────────
function _isGuestUser() {
  return currentUser && currentUser.isAnonymous;
}
// Redirige vers l'écran d'inscription (onglet Inscription) pour les anonymes.
// toastKey : clé LANGS optionnelle pour expliquer pourquoi avant de basculer
// d'écran (sinon le changement d'écran est brutal, sans contexte).
function _promptSignUp(toastKey) {
  if (toastKey && typeof showToast === 'function') {
    showToast('info', (typeof t !== 'undefined' && t[toastKey]) || t.guest_signup_generic, 3500);
  }
  showScreen('screenAuth');
  setTimeout(() => { if (typeof window.showTab === 'function') window.showTab('register'); }, 150);
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged, updateProfile, EmailAuthProvider, linkWithCredential, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp, GeoPoint } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import WorldService, { buildGeohashFields, encodeGeohash } from './services/world.service.js?v=6';
import GhostService from './services/ghost.service.js';
import LocationService from './services/location.service.js';
import AudioService from './services/audio.service.js';
import HapticsService from './services/haptics.service.js';

// ── Init audio on first user gesture ────────────────────
document.addEventListener('click', () => { AudioService.init(); AudioService.resume(); }, { once: true });
document.addEventListener('touchstart', () => { AudioService.init(); AudioService.resume(); }, { once: true });

// ── Durée minimale d'affichage de l'intro (Lot R) ───────────
// #screenOnboard est actif par défaut dans le HTML dès le chargement ; ne
// garantit un délai que pour les transitions AUTOMATIQUES qui l'écartent
// (onAuthStateChanged) — les clics explicites ("Passer", "← retour", CTA)
// appellent showScreen() directement ailleurs et ne passent pas par ici.
const _APP_LOAD_TS = Date.now();
const _INTRO_MIN_DISPLAY_MS = 2000; // Lot S : porté de 1s à 2s
function _waitMinIntroDisplay() {
  const remaining = _INTRO_MIN_DISPLAY_MS - (Date.now() - _APP_LOAD_TS);
  return remaining > 0 ? new Promise(r => setTimeout(r, remaining)) : Promise.resolve();
}

// ── I18N ─────────────────────────────────────────────────
const LANGS = {
  fr: {
    // Onboarding
    ob_tagline: 'Des inconnus ont laissé quelque chose ici.<br>Approchez-vous.',
    ob_start: '👻 Commencer',
    ob_how_title: 'Comment ça marche',
    ob_step1: 'Approchez-vous d\'un lieu pour découvrir des messages cachés',
    ob_step2: 'Ouvrez l\'enveloppe et lisez ce qu\'un inconnu a laissé là',
    ob_step3: 'Déposez vos propres traces — elles resteront ancrées ici',
    ob_back: '← Retour',
    // Auth
    auth_login: 'Se connecter',
    auth_register: 'Créer un compte',
    auth_pseudo: 'Pseudo',
    auth_email: 'Email',
    auth_password: 'Mot de passe',
    auth_login_btn: 'Se connecter',
    auth_register_btn: 'Créer mon compte',
    auth_err_fields: 'Remplissez tous les champs.',
    auth_err_short_pass: 'Mot de passe trop court (6 car. min).',
    auth_err_email: 'Email invalide.',
    auth_err_pseudo_len: 'Pseudo entre 2 et 30 caractères.',
    auth_err_email_used: 'Email déjà utilisé.',
    auth_err_wrong: 'Email ou mot de passe incorrect.',
    auth_err_network: 'Connexion impossible — vérifiez votre connexion et réessayez.',
    auth_err_generic: 'Une erreur est survenue — réessayez.',
    auth_forgot_link: 'Mot de passe oublié ?',
    auth_forgot_need_email: 'Saisissez votre email pour recevoir le lien de réinitialisation.',
    auth_forgot_sent: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    auth_forgot_failed: 'Échec de l\'envoi — vérifiez votre connexion et réessayez.',
    auth_show_password: 'Afficher le mot de passe',
    auth_hide_password: 'Masquer le mot de passe',
    // Radar
    radar_guest_banner: 'Mode exploration — créez un compte pour déposer vos fantômes',
    guest_signup_open: 'Créez un compte gratuit pour ouvrir ce fantôme',
    guest_signup_deposit: 'Créez un compte gratuit pour déposer un fantôme',
    guest_signup_profile: 'Créez un compte gratuit pour accéder à votre profil',
    guest_signup_generic: 'Créez un compte gratuit pour continuer',
    radar_locating: 'Localisation en cours…',
    radar_searching: '🔍 Recherche de fantômes…',
    radar_no_gps: 'Géolocalisation refusée — autorisez-la dans les réglages de votre navigateur pour découvrir les fantômes proches.',
    radar_retry_btn: '↻ Réessayer',
    map_load_err: '⚠️ Impossible de charger la carte — vérifiez votre connexion.',
    radar_no_ghosts: 'Aucun fantôme proche — soyez le premier !',
    radar_no_ghosts_widened: 'Aucun fantôme à 5km — affichage élargi 50km',
    radar_firestore_err: 'Impossible de charger les fantômes — vérifiez votre connexion.',
    radar_offline: '📵 Hors ligne — données peut-être incomplètes.',
    radar_welcome_title: 'Bienvenue dans Ghostub',
    radar_welcome_sub: 'Aucun message caché ici pour l\'instant.<br>Vous pouvez en laisser un — quelqu\'un passera peut-être.',
    radar_how_title: 'Comment ça marche',
    radar_how1: 'Déposez un message ancré à ce lieu',
    radar_how2: 'Le radar détecte les fantômes proches',
    radar_how3: 'Approchez-vous pour ouvrir l\'enveloppe',
    radar_first_btn: '👻 Déposer mon premier fantôme',
    radar_empty_title: 'Aucun fantôme dans ce lieu',
    radar_empty_sub: 'Soyez le premier à hanter cet endroit.',
    radar_deposit_btn: '👻 Déposer un fantôme',
    radar_filter_empty: 'Aucun fantôme dans ce filtre.',
    radar_new_ghost: '👻 {n} nouveau{x} fantôme{s} à proximité',
    // Detail
    detail_first_reader: '🥇 Vous êtes le premier à lire ce message',
    detail_ghost_gone: 'Ce fantôme n\'existe plus.',
    detail_location_unknown: 'Lieu inconnu',
    detail_sealed_label: 'Une trace vous attend ici',
    detail_anonymous: 'Anonyme',
    detail_from_you: 'de vous',
    detail_open_aria: 'Ouvrir le fantôme et révéler le message',
    dep_dur_24h: '24h',
    dep_dur_7d: '7 jours',
    dep_dur_1m: '1 mois',
    dep_dur_eternal: '♾ Éternel',
    dep_maxopen_inf: '∞ Illimité',
    dep_maxopen_1: '1 lecture',
    dep_maxopen_5: '5 lectures',
    dep_maxopen_10: '10 lectures',
    dep_maxopen_locked: '🔒 5/10 lectures réservé au Premium — reste à 1 lecture ou passe Premium.',
    dep_cond_always_label: 'Toujours accessible',
    dep_cond_always_sub: 'N\'importe quand',
    dep_cond_night_label: 'La nuit uniquement',
    dep_cond_night_sub: 'Accessible entre 22h et 6h',
    dep_cond_hour_label: 'À une heure précise',
    dep_cond_hour_sub: 'Fenêtre de ±15 min',
    dep_cond_chain_label: 'Après un autre fantôme',
    dep_cond_chain_sub: 'Chasse au trésor urbaine',
    dep_cond_future_label: 'Message du futur',
    dep_cond_future_sub: 'S\'ouvre à une date précise',
    detail_replies_title: 'Réponses dans ce lieu',
    detail_no_replies_html: 'Aucune réponse — soyez le premier.',
    micro_reply_placeholder: 'Réagir en un mot…',
    micro_reply_aria: 'Réagir en quelques mots, 3 maximum',
    micro_reply_send_aria: 'Envoyer la réaction',
    micro_reply_max_words: '3 mots maximum',
    detail_share_ghost_btn: '↗ Partager ce fantôme',
    detail_reply_ghost_btn: '↩ Laisser une réponse ici',
    dep_back: '← Retour',
    detail_sealed_hint: 'Approchez-vous pour briser le sceau',
    detail_of_anon: 'De 👻 Anonyme · ',
    detail_of: 'De ',
    detail_no_replies: 'Aucune réponse — soyez le premier.',
    detail_open_btn: '✉ Briser le sceau',
    detail_reply_btn: '↩ Répondre',
    detail_share_btn: '🔗 Partager',
    detail_fav_add: '★ Ajouter aux favoris',
    detail_fav_added: '★ Dans vos favoris',
    detail_report_btn: '⚑ Signaler ce fantôme',
    detail_reported: '✓ Déjà signalé',
    detail_secret_on: '🔮 Mode secret activé',
    detail_secret_off: '🔮 Passer en secret',
    detail_first_toast: '🥇 Vous êtes le premier à lire ce message !',
    detail_views: '👁 {n} personne{s} {verbe} lu ce message avant vous',
    detail_vocal: '🎙 Message vocal',
    detail_video_label: '🎥 Vidéo',
    detail_photo_label: '📷 Photo',
    detail_report_media: '⚑ Signaler',
    detail_promo_label: '🏪 Offre exclusive',
    detail_promo_hint: 'Présentez ce message en caisse pour en bénéficier',
    detail_chain_label: '🔗 La piste continue…',
    detail_chain_btn: '🗺 Suivre la piste →',
    detail_reso_used: '✦ Résonance utilisée aujourd\'hui',
    detail_reso_btn: '✦ Résonner · {n} résonances',
    detail_reso_sent: '✦ Résonance envoyée — merci ✨',
    detail_reso_wait: '⏳ Prochaine résonance dans {h}h{m}',
    detail_expired_last: '👻 Ce fantôme vient de disparaître — vous étiez le dernier à pouvoir le lire.',
    // Envelope
    env_gps_checking: '📡 Vérification de votre position…',
    env_gps_slow: '⚠️ GPS trop long — déplacez-vous en extérieur et réessayez.',
    env_gps_unavail: '⚠️ GPS indisponible sur cet appareil.',
    env_gps_denied: '⚠️ GPS indisponible — vérifiez votre signal ou autorisez la géolocalisation dans les réglages de votre navigateur.',
    env_resist: '🌫️ Le sceau résiste encore',
    env_resist_dist: 'encore {n}m à parcourir',
    env_hint_reset: 'Approchez-vous pour briser le sceau',
    // Deposit
    dep_title: 'Déposer',
    dep_msg_placeholder: 'Laissez un message à cet endroit…',
    // Phase 1 v100 — La Lettre
    dep_lettre_salutation: 'À qui passera par ici,',
    dep_lettre_stamp_label: 'Sceau :',
    dep_lettre_placeholder: 'Une pensée, un souvenir, un secret… que vous laissez à qui saura le trouver.',
    dep_lettre_signature: '— ancré ici, à jamais',
    dep_seal_btn: 'Sceller le fantôme',
    dep_seal_hint: 'ancré à ta position actuelle, en un geste',
    // Phase 1b v101 — La Nappe (bottom sheet)
    dep_tool_lieu: 'Lieu',
    dep_tool_rules: 'Règles',
    dep_tool_media: 'Média',
    dep_sheet_title: 'Réglages du fantôme',
    dep_sheet_back: 'Retour au message',
    dep_sheet_done: 'Terminer',
    // Phase 1c v102 — Mode Commerce dans la nappe
    dep_sheet_biz_title: "Réglages de l'offre",
    dep_sheet_biz_badge: '✦ Commerce',
    dep_sheet_biz_hint: 'Visible 50m max · 1 mois · réglages auto',
    // Phase 1d v103 — Galerie de fichiers Premium
    prem_attach_label: 'Documents',
    prem_attach_sub: 'PDF, JPG, PNG · jusqu\'à 3 fichiers',
    dep_attach_label: '📎 Documents (optionnel)',
    dep_attach_btn: 'Ajouter un fichier',
    dep_attach_count_hint: '3 fichiers maximum · 10 Mo chacun',
    dep_attach_remaining: 'emplacements restants',
    dep_attach_full_hint: 'Maximum atteint — retire un fichier pour en ajouter',
    dep_attach_full: 'Maximum 3 fichiers atteints',
    dep_attach_too_big: 'Fichier trop lourd (max 10 Mo)',
    dep_attach_wrong_type: 'Format non supporté (PDF, JPG, PNG uniquement)',
    dep_attach_locked: 'Fichiers joints réservés au Premium',
    dep_loc_placeholder: 'Nom du lieu (rue, café, parc…)',
    dep_loc_searching: 'Recherche du lieu…',
    dep_emoji_placeholder: 'Emoji (👻)',
    dep_btn: '👻 Ancrer ce fantôme',
    dep_btn_upload: '⬆ Upload…',
    dep_btn_saving: '✓ Upload · Sauvegarde…',
    dep_success: '👻 Votre trace est ancrée dans ce lieu…',
    dep_err_msg: 'Écrivez un message.',
    dep_err_long: 'Message trop long (600 caractères max).',
    dep_err_gps: 'Géolocalisation requise — activez-la dans votre navigateur.',
    dep_err_offline: 'Vous êtes hors ligne — reconnectez-vous pour déposer.',
    dep_err_generic: 'Erreur lors du dépôt — vérifie ta connexion et réessaie.',
    dep_err_denied: 'Dépôt refusé — certains champs ne sont pas autorisés. Réessaie ou contacte le support.',
    dep_upload_failed: "L'envoi a échoué — vérifie ta connexion et réessaie.",
    misc_error_generic: 'Erreur — réessaie plus tard.',
    open_quota_network_err: 'Connexion instable — impossible de vérifier ton quota. Réessaie dans un instant.',
    stripe_btn_premium: '✦ Devenir Chasseur Premium',
    stripe_btn_commerce: '🏪 Activer le Plan Commerce',
    stripe_pending_premium: 'Paiement en ligne bientôt disponible — utilise un code pour l’instant.',
    stripe_pending_commerce: 'Paiement Commerce bientôt disponible — contacte appghostub@gmail.com',
    dep_err_spam: '🏪 Pour les messages commerciaux, utilisez le Mode Commerce Premium.',
    dep_record_btn: 'Enregistrer un message vocal',
    dep_record_label: 'Enregistrer',
    dep_photo_btn_short: 'Ajouter une photo',
    dep_photo_camera: 'Appareil photo',
    dep_photo_gallery: 'Galerie',
    dep_video_btn_short: 'Ajouter une vidéo',
    premium_feature: 'Fonctionnalité Premium',
    premium_activate: 'Activer un code →',
    profile_map_loading: 'Chargement de votre empreinte…',
    dep_record_stop: '⏹ Arrêter l\'enregistrement',
    dep_photo_btn: '📷 Ajouter une photo',
    dep_video_btn: '🎥 Ajouter une vidéo (Premium)',
    dep_video_locked: '🔒 La vidéo est réservée aux membres Premium.',
    dep_video_big: 'Vidéo trop lourde — 50 Mo maximum.',
    dep_mic_denied: 'Microphone non autorisé.',
    dep_photo_invalid: 'Fichier non valide — images uniquement.',
    dep_duration_label: 'Durée de vie',
    dep_radius_label: 'Rayon de détection',
    dep_identity_label: 'Identité',
    dep_anon_toggle_off: '🌫️ rester anonyme',
    dep_anon_toggle_on: '👻 anonyme',
    dep_media_add_btn: 'Ajouter un média',
    dep_vocal_label: 'Message vocal (optionnel)',
    dep_photo_label: 'Photo (optionnel)',
    dep_video_optional: 'Vidéo (optionnel)',
    dep_attach_label_short: 'Documents (optionnel)',
    profile_code_question: 'Vous avez un code d\'activation ?',
    dep_dedicated_hint: 'Laisse vide pour que n\'importe qui puisse l\'ouvrir.',
    dep_future_hint: 'Le fantôme sera invisible jusqu\'à cette date — comme un message dans une bouteille',
    reply_msg_label: 'Votre message',
    dep_identity_named: '🌫️ Signé',
    dep_identity_anon: '👻 Anonyme',
    dep_secret_label: '🔮 Secret (3m)',
    dep_secret_normal: '👁 Normal',
    dep_next_btn: 'Continuer →',
    dep_chain_hint: 'Indice vers le prochain fantôme…',
    dep_chain_place: 'Placer le prochain point sur la carte',
    dep_chain_placed: '✓ Point placé — retap pour déplacer',
    dep_biz_btn: 'Mode Commerce',
    dep_biz_sub: 'Attirer des clients avec une offre géolocalisée',
    dep_biz_active: 'Mode activé — formulaire commerce',
    dep_biz_deposit: '🏪 Publier cette offre',
    dep_biz_visual_title: 'Ajouter un visuel',
    dep_biz_visual_sub: 'Photo ou vidéo pour illustrer votre offre (optionnel).',
    dep_deposit_btn: '👻 Ancrer ce fantôme',
    dep_pending: 'En cours…',
    dep_deleting: '⏳ Suppression…',
    auth_loading: 'Connexion…',
    profile_notif_denied: '🔕 Notifications refusées',
    dep_biz_toast: '🏪 Mode Commerce activé — visible à 50m de votre établissement',
    dep_biz_locked: '🔒 Mode Commerce réservé au Premium — entrez un code dans votre profil.',
    dep_biz_title_err: '⚠️ Ajoutez un titre à votre offre.',
    dep_biz_publish: '🏪 Publier cette offre',
    dep_cond_label: 'Condition d\'ouverture',
    dep_cond_always: 'Toujours',
    dep_cond_night: '🌙 La nuit',
    dep_cond_hour: '⏰ À l\'heure',
    dep_cond_after: '🔗 Après un autre',
    dep_cond_future: '📅 Dans le futur',
    dep_cond_premium: '🔒 Fonctionnalité réservée au Premium — entrez un code dans votre profil.',
    // Profile
    profile_title: 'Mon Empreinte',
    profile_rank: 'Rang',
    profile_discovered: 'Découvertes',
    profile_deposited: 'Dépôts',
    // Teinte du Trace (Lot K)
    trace_color_spirit: 'Spirit blue',
    trace_color_violet: 'Orchidée',
    trace_color_mist: 'Brume',
    trace_color_amber: 'Ambre',
    trace_color_rose: 'Rose spectral',
    trace_color_crimson: 'Braise',
    trace_color_locked: '🔒 Teinte réservée aux membres Premium',
    // Collection de cartes (Lot L)
    collection_title: 'Ma collection',
    profile_resonances: 'Résonances',
    profile_first_reader: 'Premiers lecteurs',
    profile_favorites: 'Favoris',
    profile_notif_on: 'Notifications activées ✓',
    profile_notif_off: 'Activer les notifications',
    profile_notif_blocked: '🔕 Notifications bloquées — autorisez-les dans les réglages de votre navigateur.',
    profile_notif_enabled: '🔔 Notifications activées !',
    profile_notif_disabled: '🔕 Notifications désactivées.',
    profile_premium_label: '✦ Spectre Premium',
    profile_premium_sub: 'Toutes les fonctionnalités débloquées',
    profile_free_label: 'Plan gratuit',
    profile_premium_plan: 'Spectre Premium',
    profile_free_plan: 'Plan gratuit',
    profile_free_sub: 'Vidéo 🎥 · Chaîne 🔗 · Mode Commerce 🏪 — réservés au Premium',
    profile_code_placeholder: 'Code Premium',
    profile_activate_btn: 'Activer',
    profile_activating: 'Vérification…',
    profile_activated: 'Activé !',
    profile_code_empty: 'Entrez un code.',
    profile_code_short: 'Code trop court.',
    profile_code_invalid: 'Code invalide.',
    profile_code_used: 'Code déjà utilisé.',
    profile_code_error_generic: 'Erreur lors de l\'activation — réessayez.',
    profile_premium_toast: '✦ Premium activé ! Toutes les fonctionnalités sont débloquées.',
    profile_discovery_btn: '📜 Mes découvertes',
    profile_deposited_btn: '👻 Mes fantômes déposés',
    profile_fav_btn: '★ Mes favoris',
    profile_leaderboard_btn: '🏆 Classement',
    profile_map_title: 'Mon empreinte',
    profile_map_deposits: 'Dépôts',
    profile_map_discoveries: 'Découvertes',
    profile_map_places: 'Lieux',
    profile_map_empty: 'Votre empreinte est vide.<br>Déposez ou découvrez des fantômes !',
    profile_map_err: 'Impossible de charger l\'empreinte',
    profile_share_map: '🗺 Partager mon empreinte',
    profile_share_profile: '👻 Partager mon profil',
    profile_logout: '🚪 Déconnexion',
    profile_delete_btn: '🗑 Supprimer tous mes fantômes',
    profile_delete_confirm_title: '🗑 Supprimer tous mes fantômes ?',
    profile_delete_confirm_sub: 'Cette action est irréversible — tous vos messages et réponses seront effacés.',
    profile_delete_confirm_word: 'SUPPRIMER',
    profile_delete_confirm_type: 'Tapez <strong>{word}</strong> pour confirmer',
    profile_delete_success: '✓ {n} fantômes supprimés',
    profile_delete_err: 'Erreur — réessayez',
    profile_export_btn: '⬇ Exporter mes données',
    profile_export_ok: '✓ Export téléchargé',
    profile_export_empty: 'Aucune donnée à exporter',
    profile_export_err_network: 'Export impossible — vérifiez votre connexion et réessayez.',
    profile_export_err_generic: 'Erreur lors de l\'export — réessayez.',
    profile_day_mode: 'Mode jour',
    profile_night_mode: 'Mode nuit',
    profile_lang_label: '🌐 Langue / Language',
    // Ghost list
    ghost_hint_never_old: '🕯 Attend depuis {n} jours — jamais lu',
    ghost_hint_never: '✦ Aucun regard ne l\'a encore lu…',
    ghost_hint_night: '🌙 S\'éveille la nuit',
    ghost_hint_prereq: '🔗 Prérequis requis',
    ghost_hint_default: '✦ Un secret vous attend…',
    ghost_badge_archive: 'archive',
    ghost_badge_old: 'ancien',
    ghost_badge_virgin: '🕯 jamais lu',
    ghost_secret_locked: '🔮 Ce fantôme est secret — approchez-vous à moins de 3m pour le révéler.',
    // Map
    map_you: '📍 Vous êtes ici',
    map_hunt_on: '🎯 Chasse ON',
    map_hunt_off: '🎯 Chasse',
    profile_year_btn: '✦ Mon année',
    map_share_btn: '↗ Partager',
    dep_success_title: 'Fantôme ancré',
    dep_success_sub: 'Votre trace repose dans ce lieu.<br>Une âme la découvrira… peut-être.',
    dep_success_hint: 'Appuie pour continuer',
    dep_notif_btn: '🔔 Savoir quand il est découvert',
    dep_notif_ok: '✓ Tu seras averti',
    prem_video_label: 'Vidéo',
    prem_video_sub: 'Jusqu\'à 20 sec · s\'ouvre uniquement sur place',
    prem_video_optional: 'Vidéo (optionnel)',
    prem_chain_label: 'Chaîne de fantômes',
    prem_chain_sub: 'Chasse au trésor urbaine · enchaîne tes ghosts',
    prem_dedicated_label: 'Pour quelqu\'un',
    prem_dedicated_sub: 'Ghost secret réservé à une seule personne',
    map_hunt_toast: '🎯 Mode chasse activé — approche-toi pour ouvrir !',
    map_hunt_already: '✓ Déjà découvert',
    map_hunt_locked: '🔒 Encore {dist} à parcourir pour l\'ouvrir',
    // Reply
    reply_title: 'Répondre',
    reply_placeholder: 'Votre réponse…',
    reply_btn: '↩ Laisser une réponse',
    reply_sent: '↩ Réponse déposée',
    reply_long: 'Message trop long (280 caractères max).',
    reply_anon: '👻 Anonyme',
    reply_anon_signed: '🌫️ Signé',
    // Notifications
    notif_new_ghost_title: '👻 Nouveau fantôme proche !',
    notif_reso_title: '✦ Votre trace a résonné',
    whisper_vibration: '✦ Une âme a résonné sur ton ghost',
    notif_disc_title: '🔮 Votre fantôme secret a été trouvé !',
    notif_open_title: '✉ Votre trace a été découverte',
    notif_reply_title: '↩ Quelqu\'un vous a répondu',
    notif_biz_title: '🏪 Un client a vu votre offre !',
    notif_nearby_title: '👻 Un nouveau fantôme près de vous !',
    notif_nearby_sw_title: '👻 Un fantôme vous attend',
    notif_nearby_sw_body: 'À {dist} — un message jamais lu dans votre quartier.',
    notif_virgin_1yr: '📜 À {dist} d\'ici — une trace vieille de {n} an{s} que personne n\'a jamais lue.',
    notif_virgin_30d: '🕯 À {dist} — un message laissé il y a {n} jours, jamais ouvert.',
    notif_virgin_new: '✦ À {dist} d\'ici — un fantôme qui n\'a jamais été lu. Serez-vous le premier ?',
    notif_virgin_push: 'Un message jamais lu dans votre quartier.',
    // Toasts
    toast_fav_added: '★ Ajouté aux favoris',
    toast_fav_removed: '★ Retiré des favoris',
    toast_link_copied: '🔗 Lien copié dans le presse-papier',
    toast_share_copy_fallback: 'Copiez manuellement le lien ci-dessus',
    toast_copied: '✓ Copié !',
    toast_copy_link: '📋 Copier le lien',
    toast_delete_ghost: '🗑 Fantôme supprimé',
    toast_delete_err: 'Erreur — réessayez.',
    toast_report_sent: '✓ Signalement envoyé — merci',
    toast_report_del: 'Fantôme supprimé — merci pour la communauté. 🌫️',
    toast_report_saved: 'Signalement enregistré. Merci.',
    toast_report_err: 'Erreur — réessayez.',
    toast_renew_ok: '🏪 Offre renouvelée pour 1 mois !',
    toast_renew_err: '⚠️ Erreur lors du renouvellement.',
    toast_secret_on: '🔮 Mode secret activé',
    toast_gps_req: 'Géolocalisation requise.',
    toast_reply_err: 'Erreur — réessayez.',
    // Report
    report_title: 'Signaler ce fantôme',
    share_modal_title: 'Partager ce fantôme',
    open_limit_default_title: 'Encore un fantôme ?',
    open_limit_premium_text: '✦ Avec le <strong>Plan Premium</strong>, ouvrez un nombre illimité de fantômes par jour<br>+ chaînes de fantômes, contenu secret, et plus',
    open_limit_cancel: '← Revenir',
    blocked_back: '← Revenir',
    error_prefix: 'Erreur :',
    loading: 'Chargement…',
    report_spam: '🗑 Spam / Publicité',
    report_inappropriate: '🔞 Contenu inapproprié',
    report_harassment: '⚠ Harcèlement',
    report_own: 'Vous ne pouvez pas signaler votre propre fantôme.',
    report_already: 'Vous avez déjà signalé ce fantôme.',
    // Open limit
    open_limit_title_reached: 'Limite atteinte pour aujourd\'hui',
    open_limit_sub_reached: 'Tu as déjà ouvert <strong>{n} fantômes</strong> aujourd\'hui.<br>Reviens demain ou passe en Premium.',
    open_limit_title_last: 'Dernier fantôme du jour !',
    open_limit_sub_last: 'C\'est ta <strong>dernière ouverture</strong> gratuite d\'aujourd\'hui.<br>Demain le compteur se remet à zéro.',
    open_limit_title_remaining: 'Il te reste {n} ouverture{s} aujourd\'hui',
    open_limit_sub_remaining: 'Tu peux encore ouvrir <strong>{n} fantôme{s}</strong> gratuitement aujourd\'hui.',
    open_limit_btn_last: '✉ Utiliser ma dernière ouverture',
    open_limit_btn: '✉ Ouvrir ce fantôme',
    open_limit_toast_last: '🕯 Dernière trace du jour — reviens demain.',
    open_limit_title_done: 'Reviens demain, chasseur',
    open_limit_sub_done: 'Ton quota de demain est déjà prêt.<br>Ou passe en <strong>Premium</strong> pour continuer maintenant.',
    // Blocked conditions
    blocked_default_title: 'Ce fantôme dort encore',
    blocked_default_sub: 'Il se réveillera bientôt.',
    blocked_night_title: 'Ce fantôme s\'éveille la nuit',
    blocked_night_sub: 'Il n\'est accessible qu\'entre 22h et 6h du matin.',
    blocked_night_timer: 'avant la nuit',
    blocked_hour_sub: 'Ce fantôme n\'est accessible que 15 min autour de {time}.',
    blocked_hour_timer: 'avant l\'ouverture',
    blocked_after_title: 'Un prérequis manque',
    blocked_after_sub: 'Tu dois d\'abord trouver et ouvrir un autre fantôme pour débloquer celui-ci.',
    blocked_future_title: 'Message du futur',
    blocked_future_sub: 'Ce fantôme ne peut être ouvert qu\'à partir du {date}.',
    blocked_future_timer: 'avant l\'ouverture',
    // Confirm modal
    confirm_ok: 'Confirmer',
    confirm_cancel: 'Annuler',
    confirm_delete_ghost_title: 'Supprimer ce fantôme ?',
    confirm_delete_ghost_sub: 'Ce message et ses réponses seront définitivement effacés.',
    confirm_renew_title: 'Renouveler l\'offre ?',
    confirm_renew_sub: 'La durée de vie de cette offre sera remise à 1 mois à partir d\'aujourd\'hui.',
    confirm_renew_btn: '↻ Renouveler',
    // Share
    share_title: '👻 Fantôme à {loc}',
    share_text: 'Un fantôme t\'attend ici — approche-toi pour le découvrir.',
    share_profile_text: 'Découvrez mon empreinte fantôme.',
    share_empreinte_text: 'J\'ai laissé des traces dans {n} lieux avec l\'app Ghostub — des messages secrets ancrés dans des endroits réels. Approchez-vous.',
    share_copy_btn: '📋 Copier le lien',
    // Nav
    nav_radar: 'Radar',
    nav_map: 'Carte',
    nav_deposit: 'Déposer',
    nav_profile: 'Profil',
    // Misc
    misc_loading: 'Chargement…',
    misc_error_load: 'Erreur de chargement',
    misc_unavailable: 'Données indisponibles',
    misc_no_discoveries: 'Aucune découverte encore…',
    misc_no_deposited: 'Aucun fantôme déposé encore…',
    misc_no_favorites: 'Aucun favori encore — appuyez sur ★ dans un fantôme.',
    misc_no_leaderboard: 'Aucun chasseur encore…',
    misc_leaderboard_err: 'Impossible de charger le classement.',
    misc_biz_none: 'Aucune offre commerce active',
    misc_offline_title: '📵 Hors ligne',
    misc_update_banner: '🔄 Nouvelle version disponible',
    misc_update_btn: 'Mettre à jour',
    misc_public_profile_subtitle: 'Chasseur de fantômes',
    misc_public_profile_deposited: 'Fantômes déposés',
    misc_public_profile_opens: 'Ouvertures totales',
    misc_public_profile_map: '🗺 Empreinte publique',
    misc_public_profile_no_loc: 'Aucun lieu public',
    misc_public_profile_join: '👻 Rejoindre Ghostub',
    misc_discovery_btn_label: 'Votre dépôt',
    misc_discovery_found_label: 'Découverte',
    misc_deposit_your: 'Votre dépôt',
    misc_expire_soon: '⏰ Expire dans {n}j',
    misc_expired: '⏳ Expirée',
    misc_days_left: '⏳ {n}j restants',
    misc_opens: '👁 {n} ouverture{s}',
    misc_ptr_pull: 'Tirer pour actualiser',
    misc_ptr_release: 'Relâcher pour actualiser',
    detail_discovered_prefix: 'Fantôme découvert · <b>',
    detail_already_read_suffix: ' lu ce message avant vous',
    profile_no_ghost_deposited: 'Aucun fantôme déposé encore……',
    profile_no_public_place: 'Aucun lieu public',
    dep_biz_media_hint: 'Photo ou vidéo pour illustrer votre offre (optionnel)',
    misc_ptr_refreshing: 'Actualisation…',
    misc_screen_radar: 'Radar — Ghostub',
    misc_screen_detail: 'Détail du fantôme — Ghostub',
    misc_screen_deposit: 'Déposer un fantôme — Ghostub',
    map_title: 'Carte des fantômes',
    dep_step_message: 'Message',
    dep_step_location: 'Lieu',
    dep_step_options: 'Options',
    misc_screen_map: 'Carte — Ghostub',
    misc_screen_profile: 'Mon profil — Ghostub',
    misc_screen_auth: 'Connexion — Ghostub',
    misc_screen_onboard: 'Ghostub',
    misc_screen_reply: 'Répondre — Ghostub',
    // Extra static HTML keys
    ob_skip: 'Passer →',
    ob_sub0: 'Des messages invisibles<br>ancrés dans les lieux réels.',
    ob_title1: 'Découvrez', ob_sub1: 'Passez près d\'un lieu et les<br>fantômes autour de vous apparaissent.',
    ob_title2: 'Ouvrez', ob_sub2: 'Chaque message est une<br>enveloppe scellée à dévoiler.<br>3 ouvertures gratuites par jour.',
    ob_title3: 'Résonnez', ob_sub3: 'Une résonance par jour —<br>choisissez le message qui vous touche.',
    ob_cta: 'Entrer dans les lieux ›',
    ob_swipe_hint: 'Glissez pour découvrir →',
    ob_free: 'Gratuit · Sans pub',
    geo_primer_title: 'Votre position',
    geo_primer_sub: 'Ghostub s\'en sert uniquement pour vous montrer les fantômes déposés autour de vous.',
    geo_primer_ok: 'Activer ma position',
    geo_primer_later: 'Plus tard',
    auth_login_tab: 'Connexion',
    auth_register_tab: 'Inscription',
    auth_pass_hint: '6 caractères minimum',
    radar_area_title: 'Aux alentours',
    radar_invoke_btn: '↻ Invoquer',
    radar_invoke_tip: 'Invoquer',
    radar_rank_tip: 'Votre rang — grimpez en explorant et déposant des fantômes',
    radar_reso_tip: 'Résonance quotidienne disponible',
    radar_radius_tip: 'Rayon de détection des fantômes autour de vous',
    radar_help_tip: 'Comment ça marche ?',
    radar_section_label: 'Traces dans les alentours',
    radar_vibe_label: 'Détection active · présences en attente',
    filter_all: '🌫️ Toutes',
    filter_recent: '✨ Récentes',
    filter_photo: '📷 Visions',
    filter_audio: '🎙 Voix',
    filter_video: '🎥 Vidéos',
    reply_screen_title: 'Répondre ici',
    reply_screen_sub: 'Votre réponse restera ancrée au même endroit.',
    dep_pane1_title: 'Que laissez-vous ici ?',
    dep_pane1_sub: 'Cette trace sera ancrée à votre position.',
    dep_pane2_title: 'Où et combien de temps ?',
    dep_pane2_sub: 'Le fantôme sera ancré ici.',
    dep_pane3_title: 'Récapitulatif',
    dep_pane3_sub: 'Vérifiez avant de déposer.',
    dep_loc_label: 'Nom du lieu',
    dep_disappears_label: 'Disparaît après',
    profile_stat_discovered: 'Découverts',
    profile_stat_deposited: 'Déposés',
    profile_stat_favorites: 'Favoris ★',
    profile_stat_resonances: 'Résonances ✨',
    profile_stat_first: '🥇 Premier à lire',
    profile_stat_leaderboard: 'Classement',
    empreinte_title: 'Mon empreinte',
    empreinte_sub: 'Les traces que tu laisses dans le monde',
    empreinte_invoques: 'Invoqués',
    empreinte_sceaux: 'Sceaux brisés',
    empreinte_resonances: 'Résonances',
    empreinte_favoris: 'Favoris',
    empreinte_premier: 'Premier lecteur',
    empreinte_classement: 'Classement',
    carnet_no_reactions: 'Pas encore de réaction.',
    carnet_read_btn: '📖 Lire',
    carnet_close_btn: '📖 Refermer',
    streak_freeze_used: '🧊 Jour de grâce utilisé — ta série continue.',
    profile_stats_label: 'Mes stats',
    profile_top_hunters: '🏆 Top chasseurs',
    profile_map_section: '🗺 Mon empreinte fantôme',
    profile_map_your_deposit: 'Votre dépôt',
    profile_map_discovery: 'Découverte',
    profile_map_score: 'Score empreinte',
    profile_map_trail: 'Traces',
    profile_biz_section: '🏪 Mes offres Commerce',
    profile_discoveries_panel: 'Mes découvertes',
    profile_deposited_panel: 'Mes fantômes déposés',
    profile_favorites_panel: '★ Mes favoris',
    profile_account_section: 'Mon compte',
    profile_code_hint: 'Vous avez un code d\'activation ?',
    profile_share_map_btn: '↗ Partager',
    profile_rewatch_intro: 'Revoir l\'intro',
    profile_help_link: 'Aide & Mentions légales',
    profile_delete_all_btn: '🗑 Tout supprimer',
    // Help screen
    help_back: '← retour',
    help_title: 'Comment ça marche ?',
    help_sub: 'Tout ce que vous devez savoir sur Ghostub',
    help_discover_title: '🌫️ Découvrir un fantôme',
    help_discover_body: 'Des messages invisibles sont ancrés dans des lieux réels autour de vous. Approchez-vous physiquement pour les débloquer — ils ne s\'ouvrent qu\'à quelques mètres. Certains ont des conditions spéciales : uniquement la nuit, à une heure précise, ou après avoir trouvé un autre fantôme.',
    help_deposit_title: '📍 Déposer un fantôme',
    help_deposit_body: 'Allez dans un lieu qui vous inspire, appuyez sur 👻 Déposer et écrivez votre message. Il sera ancré à votre position GPS exacte. Vous pouvez y joindre une photo, un audio, choisir sa durée de vie et son rayon de détection.',
    help_deposit_limit: '⏱ Un seul dépôt toutes les 15 minutes — maximum 5 fantômes actifs simultanément.',
    help_premium_title: '✦ Spectre Premium',
    help_premium_sub: 'Le Premium débloque des fonctionnalités exclusives :',
    help_premium_list: '🎥 Vidéos dans vos fantômes<br>📅 Message du futur — s\'ouvre à une date précise<br>🔗 Chasse au trésor — fantômes enchaînés<br>🏪 Mode Commerce — offres exclusives pour commerçants',
    help_premium_hint: 'Activez votre code dans Profil → Mon compte.',
    help_faq_title: '❓ Questions fréquentes',
    help_faq_q1: 'Pourquoi je ne vois pas de fantômes ?',
    help_faq_a1: 'Les fantômes n\'apparaissent que si vous êtes à portée (généralement 50-500m). Activez votre GPS et déplacez-vous dans votre ville.',
    help_faq_q2: 'Mon fantôme a disparu ?',
    help_faq_a2: 'Les fantômes ont une durée de vie limitée (24h, 7 jours ou 1 mois). Certains disparaissent aussi après un certain nombre de lectures.',
    help_faq_q3: 'Comment signaler un message inapproprié ?',
    help_faq_a3: 'Appuyez sur l\'icône ⚑ dans le détail d\'un fantôme pour le signaler. Notre équipe examine chaque signalement.',
    help_faq_q4: 'Combien de fantômes puis-je ouvrir par jour ?',
    help_faq_a4: '3 ouvertures gratuites par jour. Passez en Premium pour un accès illimité.',
    help_legal_title: '📋 Mentions légales & RGPD',
    help_legal_body: '<strong>Éditeur :</strong> Ghostub — application indépendante<br><strong>Contact :</strong> <a href="mailto:appghostub@gmail.com" class="help-legal-link">appghostub@gmail.com</a><br><br><strong>Données collectées :</strong> adresse email, position GPS (uniquement lors de l\'utilisation), messages déposés.<br><br><strong>Utilisation :</strong> vos données sont utilisées exclusivement pour le fonctionnement de l\'application. Elles ne sont ni vendues ni transmises à des tiers.<br><br><strong>Suppression :</strong> vous pouvez supprimer vos fantômes et votre compte à tout moment depuis votre profil.<br><br><strong>Hébergement :</strong> Firebase (Google) — serveurs européens (europe-west9).<br><br><a href="https://pimpimshop33-dotcom.github.io/ghostub/privacy.html" target="_blank" rel="noopener" class="help-legal-link">📄 Consulter notre politique de confidentialité complète →</a><br><br>En utilisant Ghostub, vous acceptez que vos messages soient visibles par d\'autres utilisateurs à proximité géographique.',
    help_version: 'Ghostub v1.0 — Géocaching émotionnel',
    help_cond_night: 'Certains ne s\'ouvrent que la nuit (22h–6h)',
    help_cond_hour: 'D\'autres à une heure précise (±15 min)',
    help_cond_future: 'Messages du futur — s\'ouvrent à une date définie',
    help_cond_chain: 'Chasses au trésor — trouve le premier pour débloquer le suivant',
    help_haunted_title: '👻 Zones hantées',
    help_haunted_body: 'Quand plusieurs fantômes se concentrent dans un même endroit, une zone hantée apparaît sur la carte.',
    help_haunted_spot: '3–4 fantômes proches',
    help_haunted_zone: '5–7 fantômes — zone hantée',
    help_haunted_hot: '8+ fantômes — infestation totale',
    help_whisper_title: '✦ Ghost Whisper',
    help_whisper_body: 'Quand quelqu\'un résonne sur un de vos fantômes, votre téléphone vibre discrètement à l\'instant exact — pas de notification, juste une vibration mystérieuse. Vous saurez qu\'une âme a croisé votre message, sans jamais savoir qui.',
    help_reso_title: '✦ Résonance',
    help_reso_body: 'Une résonance par jour — choisissez le message qui vous touche. L\'auteur le ressentira via une vibration discrète. Votre score d\'empreinte grandit à chaque résonance reçue.',
    help_react_title: '💬 Réagir à un message',
    help_react_body: 'Sous chaque message ouvert, réagissez en un tap (😂 🥹 😢 🤨 😮 ❤️) ou écrivez une réaction de 3 mots maximum. Si c\'est votre message, vous serez prévenu de l\'émotion qu\'il a provoquée — sans jamais savoir qui a réagi.',
    help_streak_title: '🔥 Série & souvenirs',
    help_streak_body: 'Déposez ou découvrez un fantôme chaque jour pour faire grandir votre série, visible en haut de l\'écran radar — un jour de grâce automatique évite de la perdre si vous en sautez un. De temps en temps, un souvenir refait aussi surface : Ghostub vous rappelle qu\'il y a 1 mois, 3 mois, 6 mois ou 1 an, vous laissiez une trace à un endroit précis.',
    help_empreinte_title: '🗺 Mon empreinte',
    help_empreinte_body: 'Dans votre profil, une carte personnelle trace tous les endroits où vous avez déposé ou découvert des fantômes. Une ligne relie vos dépôts dans l\'ordre. Votre score ✦ reflète votre activité totale. Dans les listes "Invoqués" et "Sceaux brisés", appuyez sur 📖 Lire pour relire le texte complet de vos messages et voir les réactions reçues.',
    help_hunt_title: '🎯 Mode Chasse',
    help_hunt_body: 'Activez le Mode Chasse sur la carte pour voir les fantômes proches avec leur distance exacte.',
    help_dep_photo: 'Ajoutez une photo',
    help_dep_audio: 'Enregistrez un message vocal',
    help_dep_duration: 'Choisissez sa durée de vie : 24h, 7j, 1 mois ou éternel',
    help_dep_radius: 'Rayon de détection : 3m, 10m ou 50m',
    help_dep_dedicated: 'Ghost dédié : réservé à une seule personne (Premium)',
  },
  en: {
    // Onboarding
    ob_tagline: 'Strangers have left something here.<br>Come closer.',
    ob_start: '👻 Get started',
    ob_how_title: 'How it works',
    ob_step1: 'Move close to a location to discover hidden messages',
    ob_step2: 'Open the envelope and read what a stranger left there',
    ob_step3: 'Drop your own traces — they will stay anchored here',
    ob_back: '← Back',
    // Auth
    auth_login: 'Sign in',
    auth_register: 'Create account',
    auth_pseudo: 'Username',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_login_btn: 'Sign in',
    auth_register_btn: 'Create my account',
    auth_err_fields: 'Please fill in all fields.',
    auth_err_short_pass: 'Password too short (6 chars min).',
    auth_err_email: 'Invalid email.',
    auth_err_pseudo_len: 'Username must be 2–30 characters.',
    auth_err_email_used: 'Email already in use.',
    auth_err_wrong: 'Incorrect email or password.',
    auth_err_network: 'Connection failed — check your connection and try again.',
    auth_err_generic: 'Something went wrong — try again.',
    auth_forgot_link: 'Forgot password?',
    auth_forgot_need_email: 'Enter your email to receive the reset link.',
    auth_forgot_sent: 'If an account exists with this email, a reset link has been sent.',
    auth_forgot_failed: 'Couldn\'t send it — check your connection and try again.',
    auth_show_password: 'Show password',
    auth_hide_password: 'Hide password',
    // Radar
    radar_guest_banner: 'Exploration mode — create an account to drop your own ghosts',
    guest_signup_open: 'Create a free account to open this ghost',
    guest_signup_deposit: 'Create a free account to drop a ghost',
    guest_signup_profile: 'Create a free account to access your profile',
    guest_signup_generic: 'Create a free account to continue',
    radar_locating: 'Getting your location…',
    radar_searching: '🔍 Searching for ghosts…',
    radar_no_gps: 'Location denied — enable it in your browser settings to discover nearby ghosts.',
    radar_retry_btn: '↻ Try again',
    map_load_err: '⚠️ Could not load the map — check your connection.',
    radar_no_ghosts: 'No ghosts nearby — be the first!',
    radar_no_ghosts_widened: 'No ghosts within 5km — showing up to 50km',
    radar_firestore_err: 'Could not load ghosts — check your connection.',
    radar_offline: '📵 Offline — data may be incomplete.',
    radar_welcome_title: 'Welcome to Ghostub',
    radar_welcome_sub: 'No hidden messages here yet.<br>You can leave one — someone might pass by.',
    radar_how_title: 'How it works',
    radar_how1: 'Drop a message anchored to this place',
    radar_how2: 'The radar detects nearby ghosts',
    radar_how3: 'Move closer to open the envelope',
    radar_first_btn: '👻 Drop my first ghost',
    radar_empty_title: 'No ghosts in this area',
    radar_empty_sub: 'Be the first to haunt this place.',
    radar_deposit_btn: '👻 Drop a ghost',
    radar_filter_empty: 'No ghosts match this filter.',
    radar_new_ghost: '👻 {n} new ghost{s} nearby',
    // Detail
    detail_ghost_gone: 'This ghost no longer exists.',
    detail_location_unknown: 'Unknown place',
    detail_sealed_label: 'A trace is waiting here',
    detail_anonymous: 'Anonymous',
    detail_from_you: 'from you',
    detail_open_aria: 'Open the ghost and reveal the message',
    dep_dur_24h: '24h',
    dep_dur_7d: '7 days',
    dep_dur_1m: '1 month',
    dep_dur_eternal: '♾ Eternal',
    dep_maxopen_inf: '∞ Unlimited',
    dep_maxopen_1: '1 read',
    dep_maxopen_5: '5 reads',
    dep_maxopen_10: '10 reads',
    dep_maxopen_locked: '🔒 5/10 reads is Premium only — stays at 1 read, or go Premium.',
    dep_cond_always_label: 'Always accessible',
    dep_cond_always_sub: 'Anytime',
    dep_cond_night_label: 'Night only',
    dep_cond_night_sub: 'Accessible between 10pm and 6am',
    dep_cond_hour_label: 'At a specific time',
    dep_cond_hour_sub: '±15 min window',
    dep_cond_chain_label: 'After another ghost',
    dep_cond_chain_sub: 'Urban treasure hunt',
    dep_cond_future_label: 'Future message',
    dep_cond_future_sub: 'Opens on a specific date',
    detail_replies_title: 'Replies at this location',
    detail_no_replies_html: 'No replies yet — be the first.',
    micro_reply_placeholder: 'React in a word…',
    micro_reply_aria: 'React in a few words, 3 maximum',
    micro_reply_send_aria: 'Send reaction',
    micro_reply_max_words: '3 words maximum',
    detail_share_ghost_btn: '↗ Share this ghost',
    detail_reply_ghost_btn: '↩ Leave a reply here',
    dep_back: '← Back',
    detail_sealed_hint: 'Move closer to break the seal',
    detail_of_anon: 'From 👻 Anonymous · ',
    detail_of: 'From ',
    detail_no_replies: 'No replies yet — be the first.',
    detail_open_btn: '✉ Break the seal',
    detail_reply_btn: '↩ Reply',
    detail_share_btn: '🔗 Share',
    detail_fav_add: '★ Add to favorites',
    detail_fav_added: '★ In your favorites',
    detail_report_btn: '⚑ Report this ghost',
    detail_reported: '✓ Already reported',
    detail_secret_on: '🔮 Secret mode on',
    detail_secret_off: '🔮 Switch to secret',
    detail_first_reader: '🥇 You are the first to read this message',
    detail_first_toast: '🥇 You are the first to read this message!',
    detail_views: '👁 {n} person{s} {verbe} read this message before you',
    detail_vocal: '🎙 Voice message',
    detail_video_label: '🎥 Video',
    detail_photo_label: '📷 Photo',
    detail_report_media: '⚑ Report',
    detail_promo_label: '🏪 Exclusive offer',
    detail_promo_hint: 'Show this message at checkout to redeem',
    detail_chain_label: '🔗 The trail continues…',
    detail_chain_btn: '🗺 Follow the trail →',
    detail_reso_used: '✦ Resonance used today',
    detail_reso_btn: '✦ Resonate · {n} resonances',
    detail_reso_sent: '✦ Resonance sent — thank you ✨',
    detail_reso_wait: '⏳ Next resonance in {h}h{m}',
    detail_expired_last: '👻 This ghost just vanished — you were the last one who could read it.',
    // Envelope
    env_gps_checking: '📡 Checking your position…',
    env_gps_slow: '⚠️ GPS taking too long — go outside and try again.',
    env_gps_unavail: '⚠️ GPS not available on this device.',
    env_gps_denied: '⚠️ GPS unavailable — check your signal or allow location in your browser settings.',
    env_resist: '🌫️ The seal still resists',
    env_resist_dist: '{n}m still to go',
    env_hint_reset: 'Move closer to break the seal',
    // Deposit
    dep_title: 'Drop',
    dep_msg_placeholder: 'Leave a message at this spot…',
    // Phase 1 v100 — La Lettre
    dep_lettre_salutation: 'To whoever passes through,',
    dep_lettre_stamp_label: 'Seal:',
    dep_lettre_placeholder: 'A thought, a memory, a secret… for whoever may find it.',
    dep_lettre_signature: '— anchored here, forever',
    dep_seal_btn: 'Seal the ghost',
    dep_seal_hint: 'anchored to your current spot, in one tap',
    // Phase 1b v101 — The Sheet (bottom sheet)
    dep_tool_lieu: 'Place',
    dep_tool_rules: 'Rules',
    dep_tool_media: 'Media',
    dep_sheet_title: 'Ghost settings',
    dep_sheet_back: 'Back to message',
    dep_sheet_done: 'Done',
    // Phase 1c v102 — Commerce mode in the sheet
    dep_sheet_biz_title: 'Offer settings',
    dep_sheet_biz_badge: '✦ Commerce',
    dep_sheet_biz_hint: 'Visible within 50m · 1 month · auto-set',
    // Phase 1d v103 — File gallery Premium
    prem_attach_label: 'Files',
    prem_attach_sub: 'PDF, JPG, PNG · up to 3 files',
    dep_attach_label: '📎 Files (optional)',
    dep_attach_btn: 'Add a file',
    dep_attach_count_hint: '3 files max · 10 MB each',
    dep_attach_remaining: 'slot(s) left',
    dep_attach_full_hint: 'Maximum reached — remove a file to add another',
    dep_attach_full: 'Maximum 3 files reached',
    dep_attach_too_big: 'File too large (max 10 MB)',
    dep_attach_wrong_type: 'Unsupported format (PDF, JPG, PNG only)',
    dep_attach_locked: 'File attachments are Premium only',
    dep_loc_placeholder: 'Place name (street, café, park…)',
    dep_loc_searching: 'Looking up place…',
    dep_emoji_placeholder: 'Emoji (👻)',
    dep_btn: '👻 Anchor this ghost',
    dep_btn_upload: '⬆ Uploading…',
    dep_btn_saving: '✓ Upload · Saving…',
    dep_success: '👻 Your trace is anchored to this place…',
    dep_err_msg: 'Write a message.',
    dep_err_long: 'Message too long (600 chars max).',
    dep_err_gps: 'Location required — enable it in your browser.',
    dep_err_offline: 'You\'re offline — reconnect to drop a ghost.',
    dep_err_generic: 'Error while dropping — check your connection and try again.',
    dep_err_denied: 'Deposit rejected — some fields aren\'t allowed. Try again or contact support.',
    dep_upload_failed: 'Upload failed — check your connection and try again.',
    misc_error_generic: 'Error — please try again later.',
    open_quota_network_err: 'Unstable connection — couldn\'t check your quota. Try again in a moment.',
    stripe_btn_premium: '✦ Become a Premium Hunter',
    stripe_btn_commerce: '🏪 Activate Commerce Plan',
    stripe_pending_premium: 'Online payment coming soon — use a code for now.',
    stripe_pending_commerce: 'Commerce payment coming soon — contact appghostub@gmail.com',
    dep_err_spam: '🏪 For commercial messages, use the Premium Commerce Mode.',
    dep_record_btn: 'Record a voice message',
    dep_record_label: 'Record',
    dep_photo_btn_short: 'Add a photo',
    dep_photo_camera: 'Camera',
    dep_photo_gallery: 'Gallery',
    dep_video_btn_short: 'Add a video',
    premium_feature: 'Premium feature',
    premium_activate: 'Activate a code →',
    profile_map_loading: 'Loading your footprint…',
    dep_record_stop: '⏹ Stop recording',
    dep_photo_btn: '📷 Add a photo',
    dep_video_btn: '🎥 Add a video (Premium)',
    dep_video_locked: '🔒 Video is for Premium members only.',
    dep_video_big: 'Video too large — 50 MB maximum.',
    dep_mic_denied: 'Microphone access denied.',
    dep_photo_invalid: 'Invalid file — images only.',
    dep_duration_label: 'Lifespan',
    dep_radius_label: 'Detection radius',
    dep_identity_label: 'Identity',
    dep_anon_toggle_off: '🌫️ stay anonymous',
    dep_anon_toggle_on: '👻 anonymous',
    dep_media_add_btn: 'Add media',
    dep_vocal_label: 'Voice message (optional)',
    dep_photo_label: 'Photo (optional)',
    dep_video_optional: 'Video (optional)',
    dep_attach_label_short: 'Documents (optional)',
    profile_code_question: 'Do you have an activation code?',
    dep_dedicated_hint: 'Leave empty so anyone can open it.',
    dep_future_hint: 'The ghost will be invisible until this date — like a message in a bottle',
    reply_msg_label: 'Your message',
    dep_identity_named: '🌫️ Signed',
    dep_identity_anon: '👻 Anonymous',
    dep_secret_label: '🔮 Secret (3m)',
    dep_secret_normal: '👁 Normal',
    dep_next_btn: 'Continue →',
    dep_chain_hint: 'Hint toward the next ghost…',
    dep_chain_place: 'Place the next point on the map',
    dep_chain_placed: '✓ Point placed — tap again to move',
    dep_biz_btn: 'Commerce Mode',
    dep_biz_sub: 'Attract customers with a geolocated offer',
    dep_biz_active: 'Mode on — commerce form',
    dep_biz_deposit: '🏪 Publish this offer',
    dep_biz_visual_title: 'Add a visual',
    dep_biz_visual_sub: 'Photo or video to illustrate your offer (optional).',
    dep_deposit_btn: '👻 Anchor this ghost',
    dep_pending: 'Saving…',
    dep_deleting: '⏳ Deleting…',
    auth_loading: 'Signing in…',
    profile_notif_denied: '🔕 Notifications denied',
    dep_biz_toast: '🏪 Commerce Mode on — visible within 50m of your business',
    dep_biz_locked: '🔒 Commerce Mode is Premium only — enter a code in your profile.',
    dep_biz_title_err: '⚠️ Add a title to your offer.',
    dep_biz_publish: '🏪 Publish this offer',
    dep_cond_label: 'Opening condition',
    dep_cond_always: 'Always',
    dep_cond_night: '🌙 At night',
    dep_cond_hour: '⏰ At a time',
    dep_cond_after: '🔗 After another',
    dep_cond_future: '📅 In the future',
    dep_cond_premium: '🔒 Premium feature — enter a code in your profile.',
    // Profile
    profile_title: 'My Footprint',
    profile_rank: 'Rank',
    profile_discovered: 'Discovered',
    profile_deposited: 'Dropped',
    profile_resonances: 'Resonances',
    // Trace color (Lot K)
    trace_color_spirit: 'Spirit blue',
    trace_color_violet: 'Orchid',
    trace_color_mist: 'Mist',
    trace_color_amber: 'Amber',
    trace_color_rose: 'Spectral rose',
    trace_color_crimson: 'Ember',
    trace_color_locked: '🔒 Premium-only tint',
    // Card collection (Lot L)
    collection_title: 'My collection',
    profile_first_reader: 'First reads',
    profile_favorites: 'Favorites',
    profile_notif_on: 'Notifications enabled ✓',
    profile_notif_off: 'Enable notifications',
    profile_notif_blocked: '🔕 Notifications blocked — allow them in your browser settings.',
    profile_notif_enabled: '🔔 Notifications enabled!',
    profile_notif_disabled: '🔕 Notifications disabled.',
    profile_premium_label: '✦ Premium Spectre',
    profile_premium_sub: 'All features unlocked',
    profile_free_label: 'Free plan',
    profile_premium_plan: 'Spectre Premium',
    profile_free_plan: 'Free plan',
    profile_free_sub: 'Video 🎥 · Chain 🔗 · Commerce Mode 🏪 — Premium only',
    profile_code_placeholder: 'Premium code',
    profile_activate_btn: 'Activate',
    profile_activating: 'Checking…',
    profile_activated: 'Activated!',
    profile_code_empty: 'Enter a code.',
    profile_code_short: 'Code too short.',
    profile_code_invalid: 'Invalid code.',
    profile_code_used: 'Code already used.',
    profile_code_error_generic: 'Error activating the code — try again.',
    profile_premium_toast: '✦ Premium activated! All features are unlocked.',
    profile_discovery_btn: '📜 My discoveries',
    profile_deposited_btn: '👻 My dropped ghosts',
    profile_fav_btn: '★ My favorites',
    profile_leaderboard_btn: '🏆 Leaderboard',
    profile_map_title: 'My footprint',
    profile_map_deposits: 'Drops',
    profile_map_discoveries: 'Discoveries',
    profile_map_places: 'Places',
    profile_map_empty: 'Your footprint is empty.<br>Drop or discover ghosts!',
    profile_map_err: 'Could not load your footprint',
    profile_share_map: '🗺 Share my footprint',
    profile_share_profile: '👻 Share my profile',
    profile_logout: '🚪 Sign out',
    profile_delete_btn: '🗑 Delete all my ghosts',
    profile_delete_confirm_title: '🗑 Delete all my ghosts?',
    profile_delete_confirm_sub: 'This is irreversible — all your messages and replies will be deleted.',
    profile_delete_confirm_word: 'DELETE',
    profile_delete_confirm_type: 'Type <strong>{word}</strong> to confirm',
    profile_delete_success: '✓ {n} ghosts deleted',
    profile_delete_err: 'Error — try again',
    profile_export_btn: '⬇ Export my data',
    profile_export_ok: '✓ Export downloaded',
    profile_export_empty: 'No data to export',
    profile_export_err_network: 'Export failed — check your connection and try again.',
    profile_export_err_generic: 'Error exporting your data — try again.',
    profile_day_mode: 'Day mode',
    profile_night_mode: 'Night mode',
    profile_lang_label: '🌐 Langue / Language',
    // Ghost list
    ghost_hint_never_old: '🕯 Waiting {n} days — never read',
    ghost_hint_never: '✦ No one has read this yet…',
    ghost_hint_night: '🌙 Awakens at night',
    ghost_hint_prereq: '🔗 Prerequisite required',
    ghost_hint_default: '✦ A secret awaits you…',
    ghost_badge_archive: 'archive',
    ghost_badge_old: 'old',
    ghost_badge_virgin: '🕯 unread',
    ghost_secret_locked: '🔮 This ghost is secret — move within 3m to reveal it.',
    // Map
    map_you: '📍 You are here',
    map_hunt_on: '🎯 Hunt ON',
    map_hunt_off: '🎯 Hunt',
    profile_year_btn: '✦ My year',
    map_share_btn: '↗ Share',
    dep_success_title: 'Ghost anchored',
    dep_success_sub: 'Your trace rests in this place.<br>A soul will discover it… perhaps.',
    dep_success_hint: 'Tap to continue',
    dep_notif_btn: '🔔 Know when it\'s discovered',
    dep_notif_ok: '✓ You\'ll be notified',
    prem_video_label: 'Video',
    prem_video_sub: 'Up to 20 sec · opens only on site',
    prem_video_optional: 'Video (optional)',
    prem_chain_label: 'Ghost chain',
    prem_chain_sub: 'Urban treasure hunt · chain your ghosts',
    prem_dedicated_label: 'For someone',
    prem_dedicated_sub: 'Secret ghost reserved for one person',
    map_hunt_toast: '🎯 Hunt mode on — get close to open!',
    map_hunt_already: '✓ Already discovered',
    map_hunt_locked: '🔒 Still {dist} away to open it',
    // Reply
    reply_title: 'Reply',
    reply_placeholder: 'Your reply…',
    reply_btn: '↩ Leave a reply',
    reply_sent: '↩ Reply posted',
    reply_long: 'Message too long (280 chars max).',
    reply_anon: '👻 Anonymous',
    reply_anon_signed: '🌫️ Signed',
    // Notifications
    notif_new_ghost_title: '👻 New ghost nearby!',
    notif_reso_title: '✦ Your trace resonated',
    whisper_vibration: '✦ A soul resonated with your ghost',
    notif_disc_title: '🔮 Your secret ghost was found!',
    notif_open_title: '✉ Your trace was discovered',
    notif_reply_title: '↩ Someone replied to you',
    notif_biz_title: '🏪 A customer saw your offer!',
    notif_nearby_title: '👻 A new ghost near you!',
    notif_nearby_sw_title: '👻 A ghost is waiting for you',
    notif_nearby_sw_body: '{dist} away — an unread message in your area.',
    notif_virgin_1yr: '📜 {dist} from here — a trace {n} year{s} old that no one has ever read.',
    notif_virgin_30d: '🕯 {dist} away — a message left {n} days ago, never opened.',
    notif_virgin_new: '✦ {dist} from here — a ghost that has never been read. Will you be the first?',
    notif_virgin_push: 'An unread message in your area.',
    // Toasts
    toast_fav_added: '★ Added to favorites',
    toast_fav_removed: '★ Removed from favorites',
    toast_link_copied: '🔗 Link copied to clipboard',
    toast_share_copy_fallback: 'Copy the link manually above',
    toast_copied: '✓ Copied!',
    toast_copy_link: '📋 Copy link',
    toast_delete_ghost: '🗑 Ghost deleted',
    toast_delete_err: 'Error — try again.',
    toast_report_sent: '✓ Report sent — thank you',
    toast_report_del: 'Ghost removed — thank you for the community. 🌫️',
    toast_report_saved: 'Report recorded. Thank you.',
    toast_report_err: 'Error — try again.',
    toast_renew_ok: '🏪 Offer renewed for 1 month!',
    toast_renew_err: '⚠️ Renewal error.',
    toast_secret_on: '🔮 Secret mode on',
    toast_gps_req: 'Location required.',
    toast_reply_err: 'Error — try again.',
    // Report
    report_title: 'Report this ghost',
    share_modal_title: 'Share this ghost',
    open_limit_default_title: 'Another ghost?',
    open_limit_premium_text: '✦ With <strong>Premium</strong>, open unlimited ghosts per day<br>+ ghost chains, secret content, and more',
    open_limit_cancel: '← Back',
    blocked_back: '← Back',
    error_prefix: 'Error:',
    loading: 'Loading…',
    report_spam: '🗑 Spam / Advertising',
    report_inappropriate: '🔞 Inappropriate content',
    report_harassment: '⚠ Harassment',
    report_own: 'You cannot report your own ghost.',
    report_already: 'You have already reported this ghost.',
    // Open limit
    open_limit_title_reached: 'Daily limit reached',
    open_limit_sub_reached: 'You\'ve already opened <strong>{n} ghosts</strong> today.<br>Come back tomorrow or go Premium.',
    open_limit_title_last: 'Last ghost of the day!',
    open_limit_sub_last: 'This is your <strong>last free open</strong> today.<br>The counter resets tomorrow.',
    open_limit_title_remaining: '{n} open{s} left today',
    open_limit_sub_remaining: 'You can still open <strong>{n} ghost{s}</strong> for free today.',
    open_limit_btn_last: '✉ Use my last open',
    open_limit_btn: '✉ Open this ghost',
    open_limit_toast_last: '🕯 Last ghost of the day — come back tomorrow.',
    open_limit_title_done: 'Come back tomorrow, hunter',
    open_limit_sub_done: 'Your tomorrow\'s quota is already ready.<br>Or go <strong>Premium</strong> to keep exploring now.',
    // Blocked conditions
    blocked_default_title: 'This ghost is still sleeping',
    blocked_default_sub: 'It will wake up soon.',
    blocked_night_title: 'This ghost awakens at night',
    blocked_night_sub: 'It is only accessible between 10 PM and 6 AM.',
    blocked_night_timer: 'until night',
    blocked_hour_sub: 'This ghost is only accessible 15 min around {time}.',
    blocked_hour_timer: 'until opening',
    blocked_after_title: 'A prerequisite is missing',
    blocked_after_sub: 'You must first find and open another ghost to unlock this one.',
    blocked_future_title: 'Message from the future',
    blocked_future_sub: 'This ghost can only be opened from {date}.',
    blocked_future_timer: 'until opening',
    // Confirm modal
    confirm_ok: 'Confirm',
    confirm_cancel: 'Cancel',
    confirm_delete_ghost_title: 'Delete this ghost?',
    confirm_delete_ghost_sub: 'This message and its replies will be permanently deleted.',
    confirm_renew_title: 'Renew the offer?',
    confirm_renew_sub: 'The lifespan of this offer will be reset to 1 month from today.',
    confirm_renew_btn: '↻ Renew',
    // Share
    share_title: '👻 Ghost at {loc}',
    share_text: 'A ghost is waiting for you here — come closer to discover it.',
    share_profile_text: 'Check out my ghost footprint.',
    share_empreinte_text: 'I\'ve left traces in {n} places with the Ghostub app — secret messages anchored in real spots. Come closer.',
    share_copy_btn: '📋 Copy link',
    // Nav
    nav_radar: 'Radar',
    nav_map: 'Map',
    nav_deposit: 'Drop',
    nav_profile: 'Profile',
    // Misc
    misc_loading: 'Loading…',
    misc_error_load: 'Load error',
    misc_unavailable: 'Data unavailable',
    misc_no_discoveries: 'No discoveries yet…',
    misc_no_deposited: 'No ghosts dropped yet…',
    misc_no_favorites: 'No favorites yet — tap ★ on a ghost.',
    misc_no_leaderboard: 'No hunters yet…',
    misc_leaderboard_err: 'Could not load leaderboard.',
    misc_biz_none: 'No active commerce offer',
    misc_offline_title: '📵 Offline',
    misc_update_banner: '🔄 New version available',
    misc_update_btn: 'Update',
    misc_public_profile_subtitle: 'Ghost hunter',
    misc_public_profile_deposited: 'Ghosts dropped',
    misc_public_profile_opens: 'Total opens',
    misc_public_profile_map: '🗺 Public footprint',
    misc_public_profile_no_loc: 'No public locations',
    misc_public_profile_join: '👻 Join Ghostub',
    misc_discovery_btn_label: 'Your drop',
    misc_discovery_found_label: 'Discovery',
    misc_deposit_your: 'Your drop',
    misc_expire_soon: '⏰ Expires in {n}d',
    misc_expired: '⏳ Expired',
    misc_days_left: '⏳ {n}d left',
    misc_opens: '👁 {n} open{s}',
    misc_ptr_pull: 'Pull to refresh',
    misc_ptr_release: 'Release to refresh',
    detail_discovered_prefix: 'Ghost discovered · <b>',
    detail_already_read_suffix: ' read this message before you',
    profile_no_ghost_deposited: 'No ghost deposited yet……',
    profile_no_public_place: 'No public place',
    dep_biz_media_hint: 'Photo or video to showcase your offer (optional)',
    misc_ptr_refreshing: 'Refreshing…',
    misc_screen_radar: 'Radar — Ghostub',
    misc_screen_detail: 'Ghost detail — Ghostub',
    misc_screen_deposit: 'Drop a ghost — Ghostub',
    map_title: 'Ghost Map',
    dep_step_message: 'Message',
    dep_step_location: 'Location',
    dep_step_options: 'Options',
    misc_screen_map: 'Map — Ghostub',
    misc_screen_profile: 'My profile — Ghostub',
    misc_screen_auth: 'Sign in — Ghostub',
    misc_screen_onboard: 'Ghostub',
    misc_screen_reply: 'Reply — Ghostub',
    // Extra static HTML keys
    ob_skip: 'Skip →',
    ob_sub0: 'Invisible messages<br>anchored in real places.',
    ob_title1: 'Discover', ob_sub1: 'Pass near a location and the<br>ghosts around you appear.',
    ob_title2: 'Open', ob_sub2: 'Every message is a<br>sealed envelope to unveil.<br>3 free opens a day.',
    ob_title3: 'Resonate', ob_sub3: 'One resonance a day —<br>pick the message that moves you.',
    ob_cta: 'Enter the locations ›',
    ob_swipe_hint: 'Swipe to discover →',
    ob_free: 'Free · No ads',
    geo_primer_title: 'Your location',
    geo_primer_sub: 'Ghostub only uses it to show you the ghosts left around you.',
    geo_primer_ok: 'Enable my location',
    geo_primer_later: 'Later',
    auth_login_tab: 'Sign in',
    auth_register_tab: 'Sign up',
    auth_pass_hint: '6 characters minimum',
    radar_area_title: 'Nearby',
    radar_invoke_btn: '↻ Invoke',
    radar_invoke_tip: 'Summon',
    radar_rank_tip: 'Your rank — climb by exploring and dropping ghosts',
    radar_reso_tip: 'Daily resonance available',
    radar_radius_tip: 'Detection radius for ghosts around you',
    radar_help_tip: 'How it works',
    radar_section_label: 'Traces around you',
    radar_vibe_label: 'Detection active · presences waiting',
    filter_all: '🌫️ All',
    filter_recent: '✨ Recent',
    filter_photo: '📷 Visions',
    filter_audio: '🎙 Voices',
    filter_video: '🎥 Videos',
    reply_screen_title: 'Reply here',
    reply_screen_sub: 'Your reply will stay anchored at the same spot.',
    dep_pane1_title: 'What are you leaving here?',
    dep_pane1_sub: 'This trace will be anchored to your location.',
    dep_pane2_title: 'Where and how long?',
    dep_pane2_sub: 'The ghost will be anchored here.',
    dep_pane3_title: 'Summary',
    dep_pane3_sub: 'Check before dropping.',
    dep_loc_label: 'Place name',
    dep_disappears_label: 'Disappears after',
    profile_stat_discovered: 'Discovered',
    profile_stat_deposited: 'Dropped',
    profile_stat_favorites: 'Favorites ★',
    profile_stat_resonances: 'Resonances ✨',
    profile_stat_first: '🥇 First reads',
    profile_stat_leaderboard: 'Leaderboard',
    empreinte_title: 'My footprint',
    empreinte_sub: 'The traces you leave in the world',
    empreinte_invoques: 'Invoked',
    empreinte_sceaux: 'Seals broken',
    empreinte_resonances: 'Resonances',
    empreinte_favoris: 'Favorites',
    empreinte_premier: 'First reader',
    empreinte_classement: 'Leaderboard',
    carnet_no_reactions: 'No reactions yet.',
    carnet_read_btn: '📖 Read',
    carnet_close_btn: '📖 Close',
    streak_freeze_used: '🧊 Grace day used — your streak continues.',
    profile_stats_label: 'My stats',
    profile_top_hunters: '🏆 Top hunters',
    profile_map_section: '🗺 My ghost footprint',
    profile_map_your_deposit: 'Your deposit',
    profile_map_discovery: 'Discovery',
    profile_map_score: 'Footprint score',
    profile_map_trail: 'Traces',
    profile_biz_section: '🏪 My commerce offers',
    profile_discoveries_panel: 'My discoveries',
    profile_deposited_panel: 'My dropped ghosts',
    profile_favorites_panel: '★ My favorites',
    profile_account_section: 'My account',
    profile_code_hint: 'Have an activation code?',
    profile_share_map_btn: '↗ Share',
    profile_rewatch_intro: 'Watch intro again',
    profile_help_link: 'Help & Legal',
    profile_delete_all_btn: '🗑 Delete all',
    // Help screen
    help_back: '← back',
    help_title: 'How does it work?',
    help_sub: 'Everything you need to know about Ghostub',
    help_discover_title: '🌫️ Discover a ghost',
    help_discover_body: 'Invisible messages are anchored to real places around you. Move physically to unlock them — they only open within a few metres. Some have special conditions: only at night, at a specific time, or after finding another ghost.',
    help_deposit_title: '📍 Drop a ghost',
    help_deposit_body: 'Go to a place that inspires you, tap 👻 Drop and write your message. It will be anchored to your exact GPS position. You can attach a photo, audio, choose its lifespan and detection radius.',
    help_deposit_limit: '⏱ One drop every 15 minutes — maximum 5 active ghosts at a time.',
    help_premium_title: '✦ Premium Spectre',
    help_premium_sub: 'Premium unlocks exclusive features:',
    help_premium_list: '🎥 Videos in your ghosts<br>📅 Future message — opens on a specific date<br>🔗 Treasure hunt — chained ghosts<br>🏪 Commerce Mode — exclusive offers for businesses',
    help_premium_hint: 'Activate your code in Profile → My account.',
    help_faq_title: '❓ Frequently asked questions',
    help_faq_q1: 'Why don\'t I see any ghosts?',
    help_faq_a1: 'Ghosts only appear if you are within range (usually 50–500m). Enable your GPS and move around your city.',
    help_faq_q2: 'My ghost disappeared?',
    help_faq_a2: 'Ghosts have a limited lifespan (24h, 7 days or 1 month). Some also disappear after a certain number of reads.',
    help_faq_q3: 'How to report an inappropriate message?',
    help_faq_a3: 'Tap the ⚑ icon in a ghost\'s detail to report it. Our team reviews every report.',
    help_faq_q4: 'How many ghosts can I open per day?',
    help_faq_a4: '3 free opens a day. Go Premium for unlimited access.',
    help_legal_title: '📋 Legal & GDPR',
    help_legal_body: '<strong>Publisher:</strong> Ghostub — independent application<br><strong>Contact:</strong> <a href="mailto:appghostub@gmail.com" class="help-legal-link">appghostub@gmail.com</a><br><br><strong>Data collected:</strong> email address, GPS position (only during use), deposited messages.<br><br><strong>Use:</strong> your data is used exclusively for the application to function. It is neither sold nor shared with third parties.<br><br><strong>Deletion:</strong> you can delete your ghosts and account at any time from your profile.<br><br><strong>Hosting:</strong> Firebase (Google) — European servers (europe-west9).<br><br><a href="https://pimpimshop33-dotcom.github.io/ghostub/privacy.html" target="_blank" rel="noopener" class="help-legal-link">📄 Read our full privacy policy →</a><br><br>By using Ghostub, you agree that your messages are visible to other users in geographic proximity.',
    help_version: 'Ghostub v1.0 — Emotional geocaching',
    help_cond_night: 'Some only open at night (10pm–6am)',
    help_cond_hour: 'Others at a specific time (±15 min)',
    help_cond_future: 'Future messages — open on a set date',
    help_cond_chain: 'Treasure hunts — find the first to unlock the next',
    help_haunted_title: '👻 Haunted zones',
    help_haunted_body: 'When several ghosts concentrate in the same area, a haunted zone appears on the map.',
    help_haunted_spot: '3–4 ghosts nearby',
    help_haunted_zone: '5–7 ghosts — haunted zone',
    help_haunted_hot: '8+ ghosts — full infestation',
    help_whisper_title: '✦ Ghost Whisper',
    help_whisper_body: 'When someone resonates on one of your ghosts, your phone vibrates discreetly at that exact moment — no notification, just a mysterious vibration. You\'ll know a soul crossed your message, without ever knowing who.',
    help_reso_title: '✦ Resonance',
    help_reso_body: 'One resonance per day — pick the message that moves you. The author will feel it through a discreet vibration. Your footprint score grows with every resonance received.',
    help_react_title: '💬 Reacting to a message',
    help_react_body: 'Under every opened message, react with a single tap (😂 🥹 😢 🤨 😮 ❤️) or write a reaction up to 3 words. If it\'s your own message, you\'ll be notified of the emotion it caused — without ever knowing who reacted.',
    help_streak_title: '🔥 Streak & memories',
    help_streak_body: 'Deposit or discover a ghost every day to grow your streak, visible at the top of the radar screen — an automatic grace day keeps it alive if you miss one. Every now and then, a memory resurfaces too: Ghostub reminds you that 1 month, 3 months, 6 months, or 1 year ago, you left a trace at a specific place.',
    help_empreinte_title: '🗺 My footprint',
    help_empreinte_body: 'In your profile, a personal map traces all the places where you have deposited or discovered ghosts. A line connects your deposits in order. Your ✦ score reflects your total activity. In the "Invoked" and "Seals broken" lists, tap 📖 Read to re-read the full text of your messages and see the reactions they received.',
    help_hunt_title: '🎯 Hunt Mode',
    help_hunt_body: 'Activate Hunt Mode on the map to see nearby ghosts with their exact distance.',
    help_dep_photo: 'Add a photo',
    help_dep_audio: 'Record a voice message',
    help_dep_duration: 'Choose its lifespan: 24h, 7d, 1 month or eternal',
    help_dep_radius: 'Detection radius: 3m, 10m or 50m',
    help_dep_dedicated: 'Dedicated ghost: reserved for one person (Premium)',

  }
};

// Détection et application de la langue
function _detectLang() {
  const saved = localStorage.getItem('ghostub_lang');
  if (saved && LANGS[saved]) return saved;
  const browser = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return LANGS[browser] ? browser : 'fr';
}
let _currentLang = _detectLang();
const t = new Proxy({}, {
  get(_, key) {
    return (LANGS[_currentLang] && LANGS[_currentLang][key] !== undefined)
      ? LANGS[_currentLang][key]
      : (LANGS['fr'][key] || key);
  }
});
window.t = t;

window.setLang = (lang) => {
  if (!LANGS[lang]) return;
  _currentLang = lang;
  localStorage.setItem('ghostub_lang', lang);
  document.documentElement.lang = lang;

  // 1. Mettre à jour tous les éléments data-i18n et data-i18n-placeholder
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t[key];
    if (val !== undefined) el.innerHTML = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t[key];
    if (val !== undefined) el.placeholder = val;
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    const val = t[key];
    if (val !== undefined) el.setAttribute('aria-label', val);
  });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const key = el.getAttribute('data-i18n-tip');
    const val = t[key];
    if (val !== undefined) el.setAttribute('data-tip', val);
  });

  // 2. Boutons langue
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  // 3. Re-render tous les écrans dynamiques (pas seulement l'écran actif)
  // car l'utilisateur peut changer la langue depuis n'importe quel écran
  // et naviguer ensuite vers un autre écran

  // Radar — toujours re-render la liste (visible ou non)
  if (typeof renderGhostList === 'function') renderGhostList();

  // Profile — re-render si les données sont déjà chargées
  if (typeof refreshProfileStats === 'function') refreshProfileStats();
  if (typeof updatePremiumUI === 'function') updatePremiumUI();
  if (typeof _renderPricingCards === 'function') _renderPricingCards();
  if (typeof _renderStreak === 'function') _renderStreak();
  if (typeof loadBizDashboard === 'function') loadBizDashboard();

  // Empreinte map — re-render seulement si déjà initialisée (évite appel Firestore inutile)
  const empreinteLoader = document.getElementById('empreinteLoader');
  if (empreinteLoader && typeof loadEmpreinteMap === 'function') loadEmpreinteMap();

  // Fermer les panels ouverts pour forcer rechargement propre
  ['discoveryHistory','depositedList','favoritesList'].forEach(id => {
    const p = document.getElementById(id);
    if (p && p.style.display !== 'none') p.style.display = 'none';
  });
  const lbPanel = document.getElementById('leaderboardPanel');
  if (lbPanel && lbPanel.style.display !== 'none') {
    if (typeof _leaderboardLoaded !== 'undefined') _leaderboardLoaded = false;
    if (typeof loadLeaderboard === 'function') loadLeaderboard();
  }

  // 4. Refresh éléments dynamiques persistants (toujours visibles)
  const currentTheme = localStorage.getItem('ghostub_theme') || 'dark';
  const lbl = document.getElementById('themeToggleLabel');
  if (lbl) lbl.textContent = currentTheme === 'light' ? t.profile_night_mode : t.profile_day_mode;
  if (typeof _setNotifBtnState === 'function') _setNotifBtnState(localStorage.getItem('notif_enabled') === '1');

  // Ghost count line — relancer le chargement pour re-générer avec la bonne langue
  // Guard: ne pas appeler avant que l'auth soit confirmée (race condition avec signInAnonymously)
  if (typeof loadNearbyGhosts === 'function' && currentUser) loadNearbyGhosts().catch(() => {});
};

// ── Composant unique "Mon empreinte" (6 cases : 3 stats + 3 pills) ──
// Un seul gabarit pour les 6 cases : seul le contenu varie (chiffre, icône,
// texte, action au clic) — jamais la structure DOM ni les styles.
function renderStatCard({ variant='lg', highlight=false, id=null, count=0,
                           icon, iconType='text', i18nKey, label,
                           onClick=null, ariaLabel=null,
                           wrapperClass='', numClass='', labelClass='' }) {
  const numContent = count == null ? '&nbsp;' : count;
  const iconHTML = iconType === 'img'
    ? `<img class="stat-card-icon" src="${icon}" aria-hidden="true">`
    : `<div class="stat-card-icon" aria-hidden="true">${icon}</div>`;
  const wrapperClasses = `stat-card stat-card--${variant}${highlight ? ' stat-card--highlight' : ''}${onClick ? ' stat-card--clickable' : ''}${wrapperClass ? ' ' + wrapperClass : ''}`;
  return `
    <div class="${wrapperClasses}"
         role="listitem"
         ${onClick ? `data-action="${onClick}"` : ''}
         ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}>
      <div class="stat-card-num${numClass ? ' ' + numClass : ''}"${id ? ` id="${id}"` : ''}>${numContent}</div>
      ${iconHTML}
      <div class="stat-card-label${labelClass ? ' ' + labelClass : ''}" data-i18n="${i18nKey}">${label}</div>
    </div>`;
}

const EMPREINTE_CARDS = [
  { variant:'lg', id:'statDeposited', count:0, iconType:'img',
    icon:'assets/brand/ghostub-mark-trace.svg', i18nKey:'empreinte_invoques',
    label:'Invoqués', onClick:'toggleDepositedList',
    ariaLabel:'Voir mes fantômes déposés' },
  { variant:'lg', highlight:true, id:'statDiscovered', count:0, iconType:'text',
    icon:'🔮', i18nKey:'empreinte_sceaux', label:'Sceaux brisés',
    onClick:'toggleDiscoveryHistory', ariaLabel:'Voir les fantômes découverts' },
  { variant:'lg', id:'statResonances', count:0, iconType:'text',
    icon:'✦', i18nKey:'empreinte_resonances', label:'Résonances' },
  { variant:'sm', id:'statFavorites', count:0, iconType:'text',
    icon:'★', i18nKey:'empreinte_favoris', label:'Favoris',
    onClick:'toggleFavoritesList', ariaLabel:'Mes favoris' },
  { variant:'sm', id:'statFirstReader', count:0, iconType:'text',
    icon:'🥇', i18nKey:'empreinte_premier', label:'Premier lecteur',
    wrapperClass:'stat-card--green',
    numClass:'stat-card-num--green',
    labelClass:'stat-card-label--green' },
  { variant:'sm', id:null, count:null, iconType:'text',
    icon:'🏆', i18nKey:'empreinte_classement', label:'Classement',
    onClick:'toggleLeaderboard', ariaLabel:'Classement',
    wrapperClass:'stat-card--gold',
    labelClass:'stat-card-label--gold' },
];

function renderEmpreinteCards() {
  const trio = document.getElementById('empreinteTrio');
  const row  = document.getElementById('empreinteRow');
  if (trio) trio.innerHTML = EMPREINTE_CARDS.slice(0, 3).map(renderStatCard).join('');
  if (row)  row.innerHTML  = EMPREINTE_CARDS.slice(3).map(renderStatCard).join('');
}
renderEmpreinteCards();

// Appliquer la langue au démarrage
document.documentElement.lang = _currentLang;
document.addEventListener("DOMContentLoaded", () => {
  setLang(_currentLang);
  // Synchroniser l'état des boutons de rayon avec la valeur localStorage
  const savedRadius = window._radarRadius || 200;
  document.querySelectorAll('.radar-radius-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.r, 10) === savedRadius);
  });
});


const firebaseConfig = {
  apiKey: "AIzaSyDtxsiaZgs2iycJRBK3SCvNuOarW7wEWaI",
  authDomain: "fantome-app.firebaseapp.com",
  projectId: "fantome-app",
  storageBucket: "fantome-app.firebasestorage.app",
  messagingSenderId: "62498675696",
  appId: "1:62498675696:web:9df717cdcda47a84d1db35"
};

let app, auth, db, functionsInstance, _checkAndConsumeOpenCallable, _activatePremiumSecureCallable, _createGhostSecureCallable;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Région europe-west9 : doit correspondre à la région de déploiement de la Cloud Function
  functionsInstance = getFunctions(app, 'europe-west9');
  _checkAndConsumeOpenCallable = httpsCallable(functionsInstance, 'checkAndConsumeOpen');
  _activatePremiumSecureCallable = httpsCallable(functionsInstance, 'activatePremiumSecure');
  _createGhostSecureCallable = httpsCallable(functionsInstance, 'createGhostSecure');
} catch (e) {
  console.error('[ghostub:init]', e);
  document.body.innerHTML = '<div class="fatal-error-screen"><div class="fatal-error-icon">😶</div><div class="fatal-error-title">Ghostub n\'a pas pu démarrer.</div><div class="fatal-error-sub">Vérifie ta connexion internet et réessaie.</div></div>';
}

const CLOUDINARY_CLOUD = 'dcarogsye';
const CLOUDINARY_UPLOAD_PRESET = 'fantome_unsigned';

const _brandImg = new Image();
_brandImg.src = 'assets/brand/ghostub-mark-trace.svg';
const _BRAND_MARK_HTML = '<img src="assets/brand/ghostub-mark-trace.svg" class="brand-mark-icon" aria-hidden="true">';
function _ghostEmojiHTML(g) {
  if (g.secret)       return '🔮';
  if (g.businessMode) return '🏪';
  if (g.emoji && g.emoji !== '👻') return escapeHTML(g.emoji);
  return _BRAND_MARK_HTML;
}

// ══════════════════════════════════════════════════════════
// TRACE COLORÉ — teinte par catégorie (Sceau) + fanage temporel
// (FEATURE-TRACE-COLORE-FANAGE.md)
//
// Palette : chaque Sceau reçoit un dégradé [clair, sombre] dans la même
// famille tonale pastel/désaturée que le Trace d'origine (#9DABFF→#C7BCEE),
// juste décliné en teinte — cohérence visuelle avant variété, comme demandé.
//   👻 neutre    : bleu-lavande d'origine, INCHANGÉ (aucun Sceau choisi)
//   💬 message   : bleu ciel  → cyan pâle   (famille --spirit, communication)
//   ❤️ cœur      : rose doux  → rose pâle
//   🌙 lune      : violet     → violet pâle (à côté du lavande, plus nocturne)
//   ✨ étincelle : or pâle    → crème       (famille --premium/--tier-gold)
//   🔥 feu       : corail     → pêche pâle  (chaud, distinct de l'ambre UI)
//   🌸 fleur     : orchidée   → lilas pâle
// Un emoji personnalisé (saisie libre dans depositEmoji) n'a pas de teinte
// dédiée — retombe sur le neutre 👻, pour ne pas avoir à mapper un espace
// infini de caractères.
// État "découvert" : dégradé or stable (famille --premium-rgb), remplace la
// teinte de catégorie et ne fane plus — signal unique "déjà trouvé".
const TRACE_CATEGORY_COLORS = {
  '👻': ['#9DABFF', '#C7BCEE'],
  '💬': ['#7AC8F5', '#A8DCF0'],
  '❤️': ['#FF9DB8', '#EEC7D8'],
  '🌙': ['#B8A8FF', '#D8CBFF'],
  '✨': ['#FFE59D', '#FFF3C7'],
  '🔥': ['#FFAD7A', '#FFD4B8'],
  '🌸': ['#C7A8FF', '#E8D4FF'],
};
const TRACE_DEFAULT_COLORS = TRACE_CATEGORY_COLORS['👻'];
const TRACE_DISCOVERED_COLORS = ['#FFD98A', '#F5DFA0'];

let _traceIdSeq = 0;
/**
 * Rendu du Trace (marque fantôme) teinté par catégorie et fané par ancienneté.
 * Remplace _ghostEmojiHTML() sur Carte/Radar (voir contraintes de la feature :
 * plus aucune icône de catégorie affichée là-bas, uniquement le Trace).
 * @param {object} g - document fantôme (createdAt/duration/lastPresenceAt pour computeLifetime)
 * @param {{size?:number, discovered?:boolean}} opts
 */
// CSP audit 4.6 : opacité/saturation/taille sont continues, calculées par
// fantôme (fanage temporel) — impossible à réduire en classes discrètes.
// Pose des data-trace-* plutôt qu'un style="" inline ; l'appelant doit passer
// le span à _hydrateTraceMarks() une fois inséré dans le DOM pour que ces
// valeurs soient appliquées via de vraies écritures JS sur .style (hors
// périmètre CSP). Tous les appelants actuels le font déjà.
function _traceMarkHTML(g, { size = 20, discovered = false, fadeOpacity = true } = {}) {
  const [c1, c2] = discovered
    ? TRACE_DISCOVERED_COLORS
    : (TRACE_CATEGORY_COLORS[g.emoji] || TRACE_DEFAULT_COLORS);

  let opacity = 1, saturation = 100;
  if (!discovered) {
    const { pct } = GhostService.computeLifetime(g);
    // pct 0 (frais) -> saturation 100% ; pct 100 (bientôt expiré) -> 15%
    // (gris-lavande pâle). L'opacité ne fane que si fadeOpacity=true (radar) :
    // sur la Carte, les marqueurs ont déjà leur propre opacité selon la
    // distance (jusqu'à ×0.25) — cumuler les deux faisait tomber des ghosts
    // âgés+lointains à ~9% d'opacité combinée, quasi invisibles
    // (BUG-REGRESSIONS-TRACE-COLORE.md, bug 1). La saturation seule suffit à
    // communiquer le fanage sans ce risque de disparition.
    saturation = 100 - (pct / 100) * 85;
    if (fadeOpacity) opacity = 1 - (pct / 100) * 0.65;
  }

  const uid = 'tm' + (_traceIdSeq++);
  // Halo sombre (drop-shadow) derrière le Trace : sans lui, les teintes pâles
  // du Trace sont quasi invisibles sur un fond clair (thème clair, tuiles
  // Leaflet non inversées) — seul le contour sombre les rend lisibles quel
  // que soit le fond (BUG-CARTE-PERSISTANT-ET-UNDEFINED.md, bug 1).
  const openTag = `<span class="trace-mark" data-trace-w="${size}" data-trace-op="${opacity.toFixed(2)}" data-trace-sat="${saturation.toFixed(0)}" aria-hidden="true">`;
  return `${openTag}<svg viewBox="0 0 200 200" width="${size}" height="${size}">` +
    `<defs>` +
    `<linearGradient id="ts-${uid}" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="${c1}" stop-opacity="1"/><stop offset="60%" stop-color="${c2}" stop-opacity=".8"/><stop offset="100%" stop-color="${c2}" stop-opacity=".4"/></linearGradient>` +
    `<linearGradient id="tf-${uid}" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="${c1}" stop-opacity=".22"/><stop offset="100%" stop-color="${c2}" stop-opacity=".08"/></linearGradient>` +
    `<radialGradient id="te-${uid}" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#F5F3FF"/><stop offset="28%" stop-color="#AEBBFF"/><stop offset="65%" stop-color="#5C6BC9"/><stop offset="100%" stop-color="#171A33"/></radialGradient>` +
    `</defs>` +
    // Contour épaissi (4.2 → 8) : Pipo remonte qu'à taille agrandie le Trace
    // restait "trop fin" — le ratio trait/silhouette compte plus que la
    // taille globale du marqueur pour la lisibilité au premier coup d'œil.
    `<path d="M100 38 C 128 38 152 62 152 95 L 152 150 C 152 150 146 168 136 156 C 128 146 122 168 112 158 C 105 151 100 168 91 160 C 82 152 76 168 66 158 C 58 150 52 160 48 150 L 48 95 C 48 62 72 38 100 38" fill="url(#tf-${uid})" stroke="url(#ts-${uid})" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<ellipse cx="79" cy="94" rx="6.5" ry="8" fill="url(#te-${uid})"/><ellipse cx="121" cy="94" rx="6.5" ry="8" fill="url(#te-${uid})"/>` +
    `<circle cx="76.5" cy="90.5" r="1.4" fill="#FFFFFF"/><circle cx="118.5" cy="90.5" r="1.4" fill="#FFFFFF"/>` +
    `</svg></span>`;
}
// Applique les data-trace-* posés par _traceMarkHTML() — de vraies écritures
// JS sur .style, jamais un style="" du markup, donc hors périmètre CSP
// (cf. commentaire sur _traceMarkHTML).
function _hydrateTraceMarks(root) {
  (root || document).querySelectorAll('.trace-mark[data-trace-w]').forEach(el => {
    const w = el.dataset.traceW;
    el.style.width = w + 'px';
    el.style.height = w + 'px';
    el.style.opacity = el.dataset.traceOp;
    el.style.filter = `saturate(${el.dataset.traceSat}%) drop-shadow(0 0 2px rgba(10,8,24,.65)) drop-shadow(0 1px 2px rgba(10,8,24,.5))`;
  });
}
// Hydrate un marqueur Leaflet créé par buildLeafletMap() : animation-delay
// et opacité (continus, par marqueur) posés en JS sur le DOM déjà créé,
// jamais en style="" — CSP audit 4.6. Voir .hunt-marker-*/.ghost-marker-*
// dans style.css pour les parties statiques.
function _hydrateMapMarker(root) {
  if (!root) return;
  const delayEl = root.querySelector('[data-mark-delay]');
  if (delayEl) delayEl.style.animationDelay = delayEl.dataset.markDelay + 's';
  const opacityEl = root.querySelector('[data-mark-opacity]');
  if (opacityEl) opacityEl.style.opacity = opacityEl.dataset.markOpacity;
  _hydrateTraceMarks(root);
}

// ══════════════════════════════════════════════════════════
// TEINTE DU TRACE DE PROFIL — personnalisation par utilisateur (Lot K)
// Distinct du Trace coloré par Sceau ci-dessus (_traceMarkHTML, par
// fantôme déposé) : ceci ne concerne que l'avatar du Profil, "le Trace qui
// représente" l'utilisateur — stocké dans users/{uid}.traceColor.
// "violet" reste la valeur par défaut (= apparence du Lot N, inchangée pour
// qui ne personnalise rien). 3 teintes gratuites + 3 réservées Premium
// (K6, décision produit non tranchée — cf. résumé de session) : même
// logique que le reste de l'app (options de base gratuites, palette élargie
// en Premium, ex. Mode Commerce, 5/10 lectures, vidéo, documents).
// ══════════════════════════════════════════════════════════
const TRACE_COLORS = [
  { id: 'spirit',  swatch: '#9DABFF', premium: false, labelKey: 'trace_color_spirit' },
  { id: 'violet',  swatch: '#B478E8', premium: false, labelKey: 'trace_color_violet' },
  { id: 'mist',    swatch: '#6EE0B0', premium: false, labelKey: 'trace_color_mist' },
  { id: 'amber',   swatch: '#F0C868', premium: true,  labelKey: 'trace_color_amber' },
  { id: 'rose',    swatch: '#FF9DC4', premium: true,  labelKey: 'trace_color_rose' },
  { id: 'crimson', swatch: '#E85A6E', premium: true,  labelKey: 'trace_color_crimson' },
];
const TRACE_COLOR_IDS = TRACE_COLORS.map(c => c.id);
let userTraceColor = 'violet';

function _applyTraceColor(colorId) {
  const avatar = document.getElementById('profileAvatar');
  if (!avatar) return;
  TRACE_COLOR_IDS.forEach(id => avatar.classList.remove('trace-color-' + id));
  avatar.classList.add('trace-color-' + (TRACE_COLOR_IDS.includes(colorId) ? colorId : 'violet'));
}

function _renderTraceColorPicker() {
  const wrap = document.getElementById('traceColorPicker');
  if (!wrap) return;
  wrap.innerHTML = TRACE_COLORS.map(c => {
    const locked = c.premium && !isPremium;
    const active = c.id === userTraceColor;
    return `<button type="button" class="trace-color-swatch trace-color-swatch-${c.id}${active ? ' active' : ''}${locked ? ' locked' : ''}" data-action="setTraceColor" data-arg="${c.id}" aria-pressed="${active}" aria-label="${t[c.labelKey] || c.id}">${locked ? '<span class="trace-color-swatch-lock" aria-hidden="true">🔒</span>' : ''}</button>`;
  }).join('');
}

window.setTraceColor = async (colorId) => {
  const color = TRACE_COLORS.find(c => c.id === colorId);
  if (!color) return;
  if (color.premium && !isPremium) {
    showToast('info', t.trace_color_locked || 'Teinte réservée Premium', 3000);
    return;
  }
  userTraceColor = colorId;
  _applyTraceColor(colorId);
  _renderTraceColorPicker();
  if (currentUser) {
    try {
      await setDoc(doc(db, COLL.USERS, currentUser.uid), { traceColor: colorId }, { merge: true });
    } catch (e) { console.warn('setTraceColor error:', e); }
  }
};

// ══════════════════════════════════════════════════════════
// ICÔNES DE CATÉGORIE (Sceau) — SVG monochrome, style nav-icon
// (viewBox 24×24, stroke=currentColor, stroke-width 1.5 — même convention
// que .nav-icon). Utilisées UNIQUEMENT sur l'écran de dépôt (sélecteur) et
// l'écran de détail (sealedEmoji) — jamais sur Carte/Radar, où seul le
// Trace coloré (_traceMarkHTML) doit apparaître.
// Pas d'entrée '👻' ici volontairement (Lot F, unification du Trace) : le
// neutre n'est jamais un Sceau parmi d'autres, c'est LE Trace, donc il doit
// toujours passer par _BRAND_MARK_HTML/_traceMarkHTML (même asset que
// l'écran d'intro) plutôt que par un contour minimaliste différent. Une
// entrée '👻' existait ici avant et n'était en pratique jamais atteinte
// (cf. l'appelant ligne ~6518, qui exclut déjà ce cas) — supprimée pour ne
// pas laisser un second dessin du fantôme trainer dans le code.
const CATEGORY_ICON_PATHS = {
  '💬': '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  '❤️': '<path d="M12 20s-7-4.3-9.3-8.7C1 8.3 2.2 4.7 5.7 4.2c2-.3 4 .7 6.3 3.1 2.3-2.4 4.3-3.4 6.3-3.1 3.5.5 4.7 4.1 3 6.9C19 15.7 12 20 12 20z"/>',
  '🌙': '<path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2z"/>',
  '✨': '<path d="M12 3l1.7 5.6L19.5 10.5l-5.8 1.9L12 18l-1.7-5.6L4.5 10.5l5.8-1.9L12 3z"/>',
  '🔥': '<path d="M12 21.5a6.3 6.3 0 0 0 6.3-6.3c0-2.6-1.6-4-2.6-6-1 1.6-1.7 2.2-1.7 2.2.5-3-1.2-5.7-3.1-7.4-.7 2.8.6 4.2-.9 6.2C8.9 11.5 8 12.8 8 14.6a4 4 0 0 0 4 4"/>',
  '🌸': '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="6.5" r="2.6"/><circle cx="12" cy="17.5" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="12" r="2.6"/>',
};
function _categoryIconHTML(emoji, { size = 20 } = {}) {
  const path = CATEGORY_ICON_PATHS[emoji];
  if (!path) return escapeHTML(emoji || ''); // emoji perso non mappé : fallback tel quel
  return `<svg class="category-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${path}</svg>`;
}

let currentUser = null;
let isPremium = false;
let userLat = null;
let userLng = null;
let nearbyGhosts = [];
// Cibles du ping sonar (angle du faisceau) — reconstruit à chaque renderRadarDots(),
// consommé en continu par _radarPingLoop() pendant que l'écran radar est actif.
let radarPingTargets = [];
let selectedGhost = null;
let map = null;
let _mapResizeObserver = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingInterval = null;
// v105 : variable d'état pour le mode de dépôt (au lieu de lire style.display)
let _depositMode = 'normal'; // 'normal' | 'business'
window._depositMode = _depositMode;

// ── ANALYTICS LÉGER ─────────────────────────────────────
// Stocke les événements localement + log console (extensible vers Firebase Analytics)
const Analytics = {
  events: JSON.parse(localStorage.getItem('ghostub_analytics') || '[]'),
  track(event, params = {}) {
    const entry = { event, params, ts: Date.now() };
    this.events.push(entry);
    // Garde seulement les 200 derniers événements
    if (this.events.length > 200) this.events.shift();
    try { localStorage.setItem('ghostub_analytics', JSON.stringify(this.events)); } catch(e) { console.warn('[ghostub:Analytics.track]', e); }
    // Si Firebase Analytics était activé, on enverrait ici
    console.debug('[Analytics]', event, params);
  },
  getSessionSummary() {
    const today = new Date().toDateString();
    return this.events.filter(e => new Date(e.ts).toDateString() === today);
  }
};

// ── INIT WORLD SERVICE ──────────────────────────────────────────────
WorldService.init(db, {
  collection, addDoc, getDocs, query, where, orderBy, limit,
  doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp
}, Analytics);


// ── COLLECTIONS FIRESTORE ────────────────────────────────
const COLL = {
  GHOSTS:  'ghosts',
  USERS:   'users',
  REPLIES: 'replies',
  NOTIFS:  'notifications',
  REPORTS: 'reports',
  DISCOVERIES: 'discoveries',
  PREMIUM_CODES: 'premiumCodes',
  GHOST_STATS: 'ghostStats',
  WHISPERS: 'whispers'
};

// ── UTILS ────────────────────────────────────────────────
// Escaper le HTML pour éviter XSS lors de l'affichage du contenu utilisateur
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const distanceMeters = (lat1, lng1, lat2, lng2) => LocationService.distanceMeters(lat1, lng1, lat2, lng2);

// Vérifie si un fantôme est expiré selon sa durée
function isExpired(g) {
  if (g.expired) return true;
  if (!g.createdAt) return false;
  // Mapping langue-indépendant : on accepte les libellés FR ET EN
  const durations = {
    '24h': 86_400_000,
    '7 jours': 604_800_000,
    '7 days': 604_800_000,
    '1 mois': 2_592_000_000,
    '1 month': 2_592_000_000
  };
  const maxAge = durations[g.duration];
  if (!maxAge) return false; // Éternel / Eternal / valeur inconnue → jamais expiré
  return (Date.now() - g.createdAt.seconds * 1000) > maxAge;
}

// ── GEOHASH NEIGHBORS ────────────────────────────────────
// Calcule les 8 cellules voisines d'un geohash — nécessaire pour couvrir
// les bords de cellule (un fantôme à 100m peut être dans une cellule adjacente)
function getGeohashNeighbors(hash) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  const NEIGHBOR = {
    right:  { even: 'bc01fg45telegramhijklmnopqrstuvwx', odd: 'p0r21436x8zb9 5y7kjqh13dc nuvhjkt' },
    left:   { even: '238967debc01telegramfg45ghi', odd: '14365h7k9dcfesgujnmqp0r2twvyx' },
    top:    { even: 'p0r21436x8zb9 5y7kjqh13dcnuvhjkt', odd: 'bc01fg45telegramhijklmnopqrstuvwx' },
    bottom: { even: '14365h7k9dcfesgujnmqp0r2twvyx', odd: '238967debcfg45ghi' },
  };
  const BORDER = {
    right:  { even: 'bcfguvyz', odd: 'prxz' },
    left:   { even: '0145hjnp', odd: '028b' },
    top:    { even: 'prxz', odd: 'bcfguvyz' },
    bottom: { even: '028b', odd: '0145hjnp' },
  };

  function _neighbor(hash, dir) {
    const last = hash.slice(-1);
    const type = hash.length % 2 === 0 ? 'even' : 'odd';
    let base = hash.slice(0, -1);
    if (BORDER[dir][type].indexOf(last) !== -1 && base.length > 0) {
      base = _neighbor(base, dir);
    }
    const neighborMap = {
      right:  '238967debc01fg45telegramhijklmnopqrstuvwx',
      left:   'bc01fg45telegramhijklmnopqrstuvwx238967de',
      top:    'p0r21436x8zb9 5y7kjqh13dcnuvhjktbc01fg45telegramhijklmnopqrstuvwx',
      bottom: 'bc01fg45telegramhijklmnopqrstuvwxp0r21436x8zb9 5y7kjqh13dcnuvhjkt',
    };
    const idx = BASE32.indexOf(last);
    return base + BASE32[idx % BASE32.length];
  }

  // Approche directe : décaler lat/lng de ±0.045° (~5km) et encoder
  // Plus fiable que l'algo de voisinage caractère par caractère
  function neighborByOffset(lat, lng, dlat, dlng, precision) {
    return encodeGeohash(
      Math.max(-90, Math.min(90, lat + dlat)),
      Math.max(-180, Math.min(180, lng + dlng)),
      precision
    );
  }

  // Décoder le geohash pour obtenir lat/lng du centre
  function decodeGeohash(hash) {
    let lat = [-90, 90], lng = [-180, 180];
    let isLng = true;
    for (const c of hash) {
      const idx = BASE32.indexOf(c);
      for (let bits = 4; bits >= 0; bits--) {
        const bit = (idx >> bits) & 1;
        if (isLng) { const mid = (lng[0] + lng[1]) / 2; lng[bit ? 0 : 1] = mid; }
        else        { const mid = (lat[0] + lat[1]) / 2; lat[bit ? 0 : 1] = mid; }
        isLng = !isLng;
      }
    }
    return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 };
  }

  const { lat, lng } = decodeGeohash(hash);
  const p = hash.length;
  const d = 0.045; // ~5km en degrés

  return [
    neighborByOffset(lat, lng,  d,  0, p), // N
    neighborByOffset(lat, lng, -d,  0, p), // S
    neighborByOffset(lat, lng,  0,  d, p), // E
    neighborByOffset(lat, lng,  0, -d, p), // W
    neighborByOffset(lat, lng,  d,  d, p), // NE
    neighborByOffset(lat, lng,  d, -d, p), // NW
    neighborByOffset(lat, lng, -d,  d, p), // SE
    neighborByOffset(lat, lng, -d, -d, p), // SW
  ].filter((v, i, arr) => arr.indexOf(v) === i && v !== hash); // déduplique
}

function formatDistance(m) {
  return m < 1000 ? Math.round(m) + 'm' : (m/1000).toFixed(1) + 'km';
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
  const fr = _currentLang === 'fr';
  if (s < 60) return fr ? 'à l\'instant' : 'just now';
  if (s < 3600) return fr ? 'il y a ' + Math.floor(s/60) + ' min' : Math.floor(s/60) + ' min ago';
  if (s < 86400) return fr ? 'il y a ' + Math.floor(s/3600) + 'h' : Math.floor(s/3600) + 'h ago';
  return fr ? 'il y a ' + Math.floor(s/86400) + ' jours' : Math.floor(s/86400) + ' days ago';
}

// ── DÉTECTION OFFLINE ────────────────────────────────────
function updateOnlineStatus() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  if (navigator.onLine) {
    banner.style.display = 'none';
    banner.setAttribute('aria-hidden', 'true');
  } else {
    banner.style.display = 'flex';
    banner.setAttribute('aria-hidden', 'false');
    Analytics.track('offline_detected');
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── FOCUS TRAP pour les modals ───────────────────────────
function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      modalEl.classList.remove('show');
      modalEl._trapHandler && modalEl.removeEventListener('keydown', modalEl._trapHandler);
      document.removeEventListener('keydown', handleKeydown);
      // Rendre le focus au déclencheur si possible
      if (modalEl._triggerEl) modalEl._triggerEl.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  modalEl._trapHandler = handleKeydown;
  document.addEventListener('keydown', handleKeydown);
}

function openModal(modalId, triggerId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal._triggerEl = triggerId ? document.getElementById(triggerId) : document.activeElement;
  modal.classList.add('show');
  // Empêcher le scroll en arrière-plan
  document.body.style.overflow = 'hidden';
  setTimeout(() => trapFocus(modal), 50);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('show');
  document.body.style.overflow = '';
  if (modal._trapHandler) {
    document.removeEventListener('keydown', modal._trapHandler);
    delete modal._trapHandler;
  }
  if (modal._triggerEl) {
    modal._triggerEl.focus();
    delete modal._triggerEl;
  }
}
window.openModal = openModal;
window.closeModal = closeModal;

window.renderStaticMap = () => {
  const centerLat = userLat || 48.8566; // Paris par défaut si GPS indisponible
  const centerLng = userLng || 2.3522;
  // #mapContainer se dimensionne lui-même via flex:1 (CSS) — on ne force plus
  // de hauteur en JS ici. L'ancien calcul (window.innerHeight - 160) était un
  // nombre magique qui ne tenait pas compte de la hauteur réelle, variable,
  // de .map-header + .map-filter-bar au-dessus : dès que cette dernière a
  // changé de mise en page (flux normal au lieu d'overlay), #leafletMap
  // (dimensionné en dur sur cette valeur) ne correspondait plus à l'espace
  // réellement disponible → tuiles manquantes/grises (BUG chevauchement Carte).
  if (!document.getElementById('leafletCSS')) {
    const css = document.createElement('link');
    css.id = 'leafletCSS';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }

  if (window.L) {
    buildLeafletMap(centerLat, centerLng);
  } else {
    // Audit 2.3 : ni onerror ni verrou anti-doublon — un CDN injoignable
    // (hors-ligne, portail captif, bloqueur de contenu) laissait l'écran
    // Carte vide indéfiniment sans message, et chaque revisite pendant
    // l'échec réinjectait une nouvelle balise <script>. id="leafletScript"
    // partagé avec _initDepositMiniMap() (même schéma déjà en place là-bas)
    // pour dédupliquer entre tous les points de chargement de Leaflet.
    let script = document.getElementById('leafletScript');
    if (!script) {
      script = document.createElement('script');
      script.id = 'leafletScript';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => buildLeafletMap(centerLat, centerLng), { once: true });
    script.addEventListener('error', () => {
      script.remove(); // permet une vraie nouvelle tentative au prochain appel
      const container = document.getElementById('mapContainer');
      if (container) {
        container.innerHTML = `<div class="map-load-err-block">${escapeHTML(t.map_load_err)}<br><button data-action="renderStaticMap" class="map-load-err-retry">${escapeHTML(t.radar_retry_btn)}</button></div>`;
      }
    }, { once: true });
  }
};


// Met à jour la vue carte sans reconstruire
function _updateMapMarkers(centerLat, centerLng) {
  if (!map) return;
  map.setView([centerLat, centerLng], map.getZoom());
  setTimeout(() => map.invalidateSize(), 100);
}

// ── MODE CHASSE ─────────────────────────────────────────
let huntMode = false;
window.toggleHuntMode = () => {
  huntMode = !huntMode;
  const btn = document.getElementById('huntModeBtn');
  if (huntMode) {
    btn.style.background = 'rgba(var(--ghost-blue-rgb),.25)';
    btn.style.color = 'rgba(200,210,255,1)';
    btn.style.borderColor = 'rgba(var(--ghost-blue-rgb),.7)';
    btn.textContent = t.map_hunt_on;
    showToast('info', t.map_hunt_toast);
  } else {
    btn.style.background = 'rgba(var(--ghost-blue-rgb),.08)';
    btn.style.color = 'rgba(var(--ghost-blue-rgb),.7)';
    btn.style.borderColor = 'rgba(var(--ghost-blue-rgb),.25)';
    btn.textContent = t.map_hunt_off;
  }
  if (window.map) renderStaticMap();
};

// Crée (ou recrée) l'instance Leaflet et son conteneur DOM — cf.
// buildLeafletMap() pour le contexte du dimensionnement via CSS et du
// filet de sécurité ResizeObserver.
function _setupLeafletMapInstance(container, centerLat, centerLng) {
  // Si la carte existe déjà — réinitialiser pour redessiner marqueurs et zones
  if (map && document.getElementById('leafletMap')) {
    try { map.remove(); } catch(e) { console.warn('[ghostub:buildLeafletMap]', e); }
    map = null;
  }

  // position:absolute + inset:0 (pas une hauteur en % ni une valeur en px
  // calculée en JS) : #mapContainer (position:relative, cf. son style inline)
  // se dimensionne via flex:1/min-height en CSS, #leafletMap épouse
  // exactement sa boîte réelle quelle que soit la hauteur du header/de la
  // barre de filtres au-dessus (cf. renderStaticMap()). height:100% seul ne
  // suffisait pas ici : un enfant direct d'un item flex n'hérite pas
  // toujours une hauteur définie en pourcentage de façon fiable.
  container.innerHTML = `<div id="leafletMap" class="leaflet-map-fill"></div>`;

  map = L.map('leafletMap', { zoomControl: false, attributionControl: false })
          .setView([centerLat, centerLng], 16);
  // Zoom en haut à droite : en bas à droite, il chevauchait l'étiquette de
  // cluster (#mapHauntedLegend, centrée en bas) sur les écrans étroits ou
  // quand plusieurs niveaux de zone sont affichés côte à côte.
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Filet de sécurité "classique Leaflet" : si le conteneur change de taille
  // après l'init (reflow tardif — police qui finit de charger, clavier
  // virtuel, rotation d'écran...), Leaflet garde son ancienne grille de
  // tuiles tant qu'on ne l'appelle pas explicitement. Un ResizeObserver
  // couvre ça en continu, pas juste une fois à un délai fixe deviné.
  if (window.ResizeObserver) {
    if (_mapResizeObserver) { try { _mapResizeObserver.disconnect(); } catch(_) {} }
    _mapResizeObserver = new ResizeObserver(() => { if (map) map.invalidateSize(); });
    _mapResizeObserver.observe(container);
  }

  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '© OSM France' }).addTo(map);
}

// Marqueur "vous êtes ici" + cercle de détection en mode chasse.
function _addUserPositionMarker(centerLat, centerLng) {
  const userIcon = L.divIcon({
    html: '<div class="user-map-dot"></div>',
    iconSize: [16,16], iconAnchor: [8,8], className: ''
  });
  L.marker([centerLat, centerLng], { icon: userIcon }).addTo(map).bindPopup('📍 Vous êtes ici');

  // En mode chasse : cercle de détection autour de l'utilisateur
  if (huntMode) {
    L.circle([centerLat, centerLng], {
      radius: 50,
      color: 'rgba(var(--ghost-blue-rgb),0.6)',
      fillColor: 'rgba(var(--ghost-blue-rgb),0.08)',
      fillOpacity: 1,
      weight: 1.5,
      dashArray: '4 4'
    }).addTo(map);
  }
}

// Dessine les marqueurs fantômes (mode chasse ou mode normal) pour la liste déjà filtrée.
function _renderMapGhostMarkers(_mapGhosts, centerLat, centerLng) {
  _mapGhosts.forEach((g, i) => {
    if (!g.lat || !g.lng) return;
    const delay = (i * 0.3).toFixed(2);
    const ghostRadius = Math.max(20, parseInt(g.radius || '50') || 50);
    const dist = distanceMeters(centerLat, centerLng, g.lat, g.lng);
    const isInRange = dist <= ghostRadius;
    const alreadyOpened = getDiscoveredIds().includes(g.id);
    // Trace coloré par catégorie + fané par ancienneté (cf.
    // FEATURE-TRACE-COLORE-FANAGE.md) — plus d'icône de catégorie brute sur
    // la carte. Secret/business gardent leurs pictos dédiés (🔮/🏪), pas
    // d'équivalent badge séparé ici contrairement au radar.
    const emojiAt = (size) => g.secret ? '🔮' : g.businessMode ? '🏪' : _traceMarkHTML(g, { size, discovered: alreadyOpened, fadeOpacity: false });
    // Halo de rareté (Lot I1) : même logique que le Radar (Lot G2) — doré
    // pour rare/légendaire, lavande pour secret, rien pour commun/uncommon.
    let _haloClass = '';
    if (g.secret) _haloClass = 'map-ghost-halo-secret';
    else { const _tier = getGhostTier(g.id); if (_tier.name === 'rare' || _tier.name === 'legendary') _haloClass = 'map-ghost-halo-rare'; }
    const haloHTML = _haloClass ? `<div class="map-ghost-halo ${_haloClass}" aria-hidden="true"></div>` : '';

    if (huntMode) {
      // Mode chasse : icône différente selon proximité
      // Trace agrandi (cf. BUG-TRACE-VIDE-MARQUEURS-CARTE.md) : la 1ʳᵉ passe
      // (~x1.4) restait trop discrète d'après Pipo — nouvelle passe, taille
      // quasi doublée par rapport à l'original pour être visible d'un coup d'œil.
      const huntIcon = L.divIcon({
        html: alreadyOpened
          ? `<div class="hunt-marker-opened">${haloHTML}${emojiAt(52)}</div>`
          : isInRange
          ? `<div class="hunt-marker-inrange" data-mark-delay="${delay}">${haloHTML}${emojiAt(56)}</div>`
          : `<div class="hunt-marker-locked">
               ${haloHTML}
               <div class="hunt-marker-locked-emoji" data-mark-delay="${delay}">${emojiAt(52)}</div>
               <div class="hunt-marker-lock-badge">🔒</div>
             </div>`,
        iconSize: [76, 76], iconAnchor: [38, 38], className: ''
      });

      // Cercle de rayon autour du fantôme
      if (!alreadyOpened) {
        L.circle([g.lat, g.lng], {
          radius: ghostRadius,
          color: isInRange ? 'rgba(100,255,180,0.5)' : 'rgba(var(--ghost-blue-rgb),0.2)',
          fillColor: isInRange ? 'rgba(100,255,180,0.05)' : 'transparent',
          fillOpacity: 1,
          weight: 1,
          dashArray: isInRange ? '' : '3 5'
        }).addTo(map);
      }

      const huntMarker = L.marker([g.lat, g.lng], { icon: huntIcon }).addTo(map);
      // animation-delay (continu, par marqueur) posé en JS sur le DOM créé par
      // Leaflet — vraie écriture .style, pas un style="" du markup, hors
      // périmètre CSP (cf. commentaire sur .hunt-marker-* dans style.css).
      _hydrateMapMarker(huntMarker.getElement());
      huntMarker.on('click', () => {
          if (alreadyOpened) {
            showToast('info', t.map_hunt_already);
          } else if (isInRange) {
            // Lot I3 : fiche bottom sheet au lieu de naviguer directement —
            // le bouton "Ouvrir" de la fiche déclenche la vraie ouverture.
            _openMapGhostSheet(g, dist);
          } else {
            const distText = dist >= 1000 ? (dist/1000).toFixed(1)+'km' : Math.round(dist)+'m';
            showToast('warning', `🔒 Encore ${distText} à parcourir pour l'ouvrir`);
            if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
          }
        });
    } else {
      // Mode normal — apparition progressive selon distance
      // Trace agrandi (cf. BUG-TRACE-VIDE-MARQUEURS-CARTE.md) : la 1ʳᵉ passe
      // (~x1.4) restait trop discrète d'après Pipo — nouvelle passe, taille
      // quasi doublée par rapport à l'original pour être visible d'un coup d'œil.
      let ghostHtml;
      if (dist <= 30) {
        // Très proche : pleine lueur + pulse
        ghostHtml = `<div class="ghost-marker-near" data-mark-delay="${delay}">${haloHTML}${emojiAt(64)}</div>`;
      } else if (dist <= 100) {
        // Proche : lueur modérée
        ghostHtml = `<div class="ghost-marker-close" data-mark-delay="${delay}">${haloHTML}${emojiAt(58)}</div>`;
      } else {
        // Loin : flou, quasi fantomatique
        const farOpacity = Math.max(0.25, 0.6 - (dist / 1000));
        ghostHtml = `<div class="ghost-marker-far" data-mark-delay="${delay}" data-mark-opacity="${farOpacity.toFixed(2)}">${haloHTML}${emojiAt(50)}</div>`;
      }
      const ghostIcon = L.divIcon({
        html: ghostHtml,
        iconSize: [78, 78], iconAnchor: [39, 39], className: ''
      });
      const ghostMarker = L.marker([g.lat, g.lng], { icon: ghostIcon }).addTo(map);
      _hydrateMapMarker(ghostMarker.getElement());
      ghostMarker.on('click', () => _openMapGhostSheet(g, dist));
    }
  });
}

// ── ZONES HANTÉES : clusters 3+ ghosts dans 80m — 3 niveaux ───────────
function _renderMapHauntedZones(_mapGhosts) {
  const _spotted = new Set();
  _mapGhosts.forEach((g) => {
    if (_spotted.has(g.id) || !g.lat || !g.lng) return;
    const cluster = _mapGhosts.filter(h =>
      h.id !== g.id && h.lat && h.lng &&
      distanceMeters(g.lat, g.lng, h.lat, h.lng) <= 300
    );
    if (cluster.length < 2) return; // min 3 ghosts total

    const clusterIds = [g.id, ...cluster.map(h => h.id)];
    clusterIds.forEach(id => _spotted.add(id));
    const n = clusterIds.length;

    // Niveau : spot (3-4) | zone hantée (5-7) | infestation (8+)
    let level, labelFr, labelEn, color, fillColor, fillOpacity, radius;
    if (n >= 8) {
      level = 'infest';
      labelFr = `🔥 Infestation · ${n}`; labelEn = `🔥 Infestation · ${n}`;
      color = 'rgba(255,80,60,0.7)'; fillColor = 'rgba(255,80,60,0.13)';
      fillOpacity = 1; radius = 250;
    } else if (n >= 5) {
      level = 'haunted';
      labelFr = `👻 Zone hantée · ${n}`; labelEn = `👻 Haunted zone · ${n}`;
      color = 'rgba(168,100,255,0.6)'; fillColor = 'rgba(168,100,255,0.10)';
      fillOpacity = 1; radius = 200;
    } else {
      level = 'spot';
      labelFr = `✦ Ghost Spot · ${n}`; labelEn = `✦ Ghost Spot · ${n}`;
      color = 'rgba(var(--premium-rgb),0.5)'; fillColor = 'rgba(var(--premium-rgb),0.07)';
      fillOpacity = 1; radius = 150;
    }

    // Cercle de chaleur extérieur (glow large) — halo qui pulse doucement
    // pour signaler "il y a du monde ici" (Lot I2).
    L.circle([g.lat, g.lng], {
      radius: radius * 1.6,
      color: 'transparent',
      fillColor,
      fillOpacity: 0.06,
      interactive: false,
      className: 'zone-halo-pulse'
    }).addTo(map);

    // Cercle principal avec bordure lumineuse — tap = fiche bottom sheet (Lot I3)
    L.circle([g.lat, g.lng], {
      radius,
      color,
      fillColor,
      fillOpacity: 0.04,
      weight: level === 'infest' ? 2 : 1.5,
      dashArray: level === 'spot' ? '4 5' : ''
    }).addTo(map).on('click', () => _openMapClusterSheet(level, n, labelFr, labelEn));
  });
}

// ── LÉGENDE zones hantées — injectée dans le conteneur Leaflet ──
function _renderMapHauntedLegend(_mapGhosts) {
  let legendEl = document.getElementById('mapHauntedLegend');
  if (!legendEl) {
    legendEl = document.createElement('div');
    legendEl.id = 'mapHauntedLegend';
    legendEl.style.cssText = 'display:none;position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000;align-items:center;gap:6px;padding:5px 12px;background:rgba(8,6,18,.85);backdrop-filter:blur(8px);border:1px solid rgba(var(--ghost-blue-rgb),.2);border-radius:20px;flex-wrap:wrap;white-space:nowrap;pointer-events:none;';
    document.getElementById('leafletMap').appendChild(legendEl);
  }
  const zones = { spot: 0, haunted: 0, infest: 0 };
  const zoneGhosts = { spot: 0, haunted: 0, infest: 0 };
  const _check = new Set();
  _mapGhosts.forEach(g => {
    if (_check.has(g.id) || !g.lat || !g.lng) return;
    const cl = _mapGhosts.filter(h => h.id !== g.id && h.lat && h.lng && distanceMeters(g.lat, g.lng, h.lat, h.lng) <= 300);
    if (cl.length < 2) return;
    const n2 = cl.length + 1;
    [g.id, ...cl.map(h => h.id)].forEach(id => _check.add(id));
    if (n2 >= 8) { zones.infest++; zoneGhosts.infest += n2; }
    else if (n2 >= 5) { zones.haunted++; zoneGhosts.haunted += n2; }
    else { zones.spot++; zoneGhosts.spot += n2; }
  });
  if (legendEl) {
    const hasAny = zones.spot || zones.haunted || zones.infest;
    if (hasAny) {
      const items = [];
      if (zones.spot)    items.push(`<span class="legend-item"><span class="legend-dot legend-dot-spot"></span><span class="legend-label legend-label-spot">Ghost Spot · ${zoneGhosts.spot}👻</span></span>`);
      if (zones.haunted) items.push(`<span class="legend-item"><span class="legend-dot legend-dot-haunted"></span><span class="legend-label legend-label-haunted">${_currentLang==='en'?'Haunted':'Hantée'} · ${zoneGhosts.haunted}👻</span></span>`);
      if (zones.infest)  items.push(`<span class="legend-item"><span class="legend-dot legend-dot-infest"></span><span class="legend-label legend-label-infest">Infestation · ${zoneGhosts.infest}👻</span></span>`);
      legendEl.innerHTML = items.join('<span class="legend-sep">·</span>');
      legendEl.style.display = 'flex';
    } else {
      legendEl.style.display = 'none';
    }
  }
}

function buildLeafletMap(centerLat, centerLng) {
  const container = document.getElementById('mapContainer');

  _setupLeafletMapInstance(container, centerLat, centerLng);
  _addUserPositionMarker(centerLat, centerLng);

  // Filtres flottants (Lot I4) — mêmes filtres Toutes/Récentes/Visions/Voix/
  // Vidéos que le Radar, appliqués à la liste source avant de dessiner
  // marqueurs et zones, pour rester cohérents entre eux.
  const _mapGhosts = _filterGhostsByType(nearbyGhosts, _mapActiveFilter);

  _renderMapGhostMarkers(_mapGhosts, centerLat, centerLng);
  _renderMapHauntedZones(_mapGhosts);
  _renderMapHauntedLegend(_mapGhosts);

  // Le compteur reflète le filtre actif (Lot I4), pas le total non filtré
  const mapCountEl = document.getElementById('mapCount');
  if (mapCountEl) mapCountEl.textContent = _mapGhosts.length + ' ' + (_currentLang === 'fr' ? 'fantôme(s)' : 'ghost(s)');

  setTimeout(() => map && map.invalidateSize(), 500);
  Analytics.track('map_opened', { ghost_count: nearbyGhosts.length, hunt_mode: huntMode });
}

// ── CARTE — Fiche bottom sheet au tap (Lot I3) ────────────
// Remplace la navigation directe vers screenDetail / le popup Leaflet par
// défaut : un tap sur un marqueur ou un cluster affiche d'abord un résumé
// (lieu, distance, rareté — jamais le message, réservé au vrai rituel
// d'ouverture) ; seul le bouton "Ouvrir" déclenche openGhost().
let _mapSheetGhostId = null;

function _openMapGhostSheet(g, dist) {
  _mapSheetGhostId = g.id;
  const iconEl = document.getElementById('mapSheetIcon');
  const alreadyOpened = getDiscoveredIds().includes(g.id);
  iconEl.innerHTML = g.secret ? '🔮' : g.businessMode ? '🏪' : _traceMarkHTML(g, { size: 40, discovered: alreadyOpened, fadeOpacity: false });
  _hydrateTraceMarks(iconEl);
  document.getElementById('mapSheetTitle').textContent = g.location || (_currentLang === 'en' ? 'Unknown place' : 'Lieu inconnu');
  const tier = g.secret ? null : getGhostTier(g.id);
  const tierLabel = tier ? getTierLabel(tier) : '';
  const bits = [formatDistance(dist), tierLabel].filter(Boolean);
  document.getElementById('mapSheetSub').textContent = bits.join(' · ') || (_currentLang === 'en' ? 'A trace left here' : 'Une trace laissée ici');
  const btn = document.getElementById('mapSheetActionBtn');
  btn.textContent = _currentLang === 'en' ? '✉ Open' : '✉ Ouvrir';
  btn.style.display = '';
  openModal('mapSheetModal');
}

function _openMapClusterSheet(level, n, labelFr, labelEn) {
  _mapSheetGhostId = null;
  document.getElementById('mapSheetIcon').textContent = level === 'infest' ? '🔥' : level === 'haunted' ? '👻' : '✦';
  document.getElementById('mapSheetTitle').textContent = _currentLang === 'en' ? labelEn : labelFr;
  document.getElementById('mapSheetSub').textContent = _currentLang === 'en'
    ? `${n} ghosts nearby — get closer to spot them.`
    : `${n} fantômes à proximité — approche-toi pour les repérer.`;
  // Pas d'ouverture directe pour un cluster, juste l'info — bouton masqué.
  document.getElementById('mapSheetActionBtn').style.display = 'none';
  openModal('mapSheetModal');
}

window.closeMapSheet = (e) => {
  // CSP audit 4.6 : ex-onclick="closeMapSheet(event)" direct sur le modal —
  // e.currentTarget pointait alors le modal lui-même. Le dispatcher délégué
  // (zone 0b) écoute sur document, donc e.currentTarget est désormais
  // toujours document — comparaison contre l'élément réel à la place, même
  // schéma que closeShareModal/closeReportModal.
  if (e && e.target !== document.getElementById('mapSheetModal')) return;
  closeModal('mapSheetModal');
};

window._mapSheetAction = () => {
  const id = _mapSheetGhostId;
  closeModal('mapSheetModal');
  if (!id) return;
  openGhost(id);
  showScreen('screenDetail');
  setNav('nav-radar');
};


function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject((_currentLang === 'en' ? 'Geolocation not supported' : 'Géolocalisation non supportée')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; resolve(pos); },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  });
}

// ── Priming avant la 1ʳᵉ demande de géolocalisation ────────────
// Explique pourquoi Ghostub a besoin de la position avant d'afficher la popup
// native du navigateur (une seule fois par navigateur, comme _maybeShowSuccessNotifPrompt
// pour les notifications). Résout true si l'utilisateur accepte de continuer,
// false s'il diffère — dans ce cas on ne démarre pas le GPS maintenant.
function _maybeShowLocationPrimer() {
  return new Promise(resolve => {
    if (localStorage.getItem('ghostub_geo_primed')) { resolve(true); return; }
    localStorage.setItem('ghostub_geo_primed', '1');
    const modal = document.getElementById('geoPrimerModal');
    if (!modal) { resolve(true); return; }
    window._geoPrimerResolve = resolve;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  });
}

window._dismissGeoPrimer = (accepted) => {
  const modal = document.getElementById('geoPrimerModal');
  if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
  if (window._geoPrimerResolve) { window._geoPrimerResolve(accepted); window._geoPrimerResolve = null; }
};

// Signale une coupure de localisation EN COURS DE SESSION (watch continu, pas
// le tout premier chargement — déjà couvert par radar_no_gps/env_gps_denied).
// Audit 2.1 : jusqu'ici seul un console.warn signalait ces erreurs ; un
// utilisateur qui coupe la localisation dans les réglages en cours d'usage
// (fréquent en extérieur) voyait le radar se figer silencieusement sur la
// dernière position connue, sans indice que distances/pings devenaient faux.
// Dédupliquée par session (pas de spam à chaque tick du watch en échec).
let _geoWatchErrorShown = false;
function _handleGeoWatchError(error) {
  console.warn('[ghostub] geoloc error', error);
  if (_geoWatchErrorShown) return;
  _geoWatchErrorShown = true;
  showToast('warning', t.radar_no_gps, 6000);
}

// Démarre le GPS watch (avec priming) si ce n'est pas déjà fait. Appelée une
// fois l'onboarding quitté (radar affiché) — jamais pendant screenOnboard,
// sinon la modale de priming s'affiche en superposition et masque le carrousel
// derrière un flou quasi opaque dès le tout premier lancement.
async function _ensureLocationReady() {
  if (!window._locationWatchStarted) {
    if (await _maybeShowLocationPrimer()) {
      window._locationWatchStarted = true;
      LocationService.startWatch();
      // Callback "pauvre" (mode invité) — remplacé par le callback riche de
      // onAuthStateChanged si l'utilisateur s'inscrit ensuite (cf. _locationUnsub).
      if (window._locationUnsub) window._locationUnsub();
      window._locationUnsub = LocationService.onPositionUpdate(({ lat, lng, accuracy, error }) => {
        if (error) { _handleGeoWatchError(error); return; }
        if (accuracy && accuracy > 5000) return;
        userLat = lat; userLng = lng;
      });
    }
  }
  if (window._locationWatchStarted) {
    try { await getLocation(); } catch(e) {}
  }
}

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;

    // ── Utilisateur anonyme — radar lecture seule ──────────
    if (user.isAnonymous) {
      // Premier lancement : on laisse le carrousel screenOnboard (déjà actif par
      // défaut dans le HTML) s'afficher, au lieu de le court-circuiter vers le
      // radar — et on ne démarre PAS le GPS/priming ici, sinon sa modale se
      // superpose au carrousel et le masque derrière un flou dès le premier
      // affichage. guestExplore()/l'inscription déclenchent le GPS après coup.
      if (localStorage.getItem('ghostub_onboard_seen')) {
        await _waitMinIntroDisplay();
        document.getElementById('bottomNav').style.display = 'flex';
        showScreen('screenRadar');
        setNav('nav-radar');
        await _ensureLocationReady();
      }
      await loadNearbyGhosts();
      return;
    }
    // ──────────────────────────────────────────────────────

    watchMyGhostResonances();
    _startWhisperListener();
    Analytics.track('session_start', { uid_hash: btoa(user.uid).slice(0,8) });
    Analytics.track('app_open');
    // FIX: Migrer les découvertes anonymes vers le compte utilisateur
    const anonKey = 'discoveries_anon';
    const anonIds = JSON.parse(localStorage.getItem(anonKey) || '[]');
    if (anonIds.length > 0) {
      const userKey = 'discoveries_' + user.uid;
      const userIds = JSON.parse(localStorage.getItem(userKey) || '[]');
      const merged = [...new Set([...userIds, ...anonIds])];
      localStorage.setItem(userKey, JSON.stringify(merged));
      localStorage.removeItem(anonKey);
    }
    const pending = sessionStorage.getItem('pendingGhost');
    if (pending) { sessionStorage.removeItem('pendingGhost'); setTimeout(() => openGhost(pending), 800); }
    document.getElementById('profileName').textContent = escapeHTML(user.displayName || user.email);
    // Avatar = Trace unifié (Lot F/J1), plus l'initiale du pseudo/email —
    // même asset que partout ailleurs (radar, carte, dépôt).
    document.getElementById('profileAvatar').innerHTML = _BRAND_MARK_HTML;
    const userDoc = await getDoc(doc(db, COLL.USERS, user.uid));
    isPremium = userDoc.exists() && userDoc.data().premium === true;
    // Teinte du Trace de profil (Lot K) — "violet" par défaut si jamais choisi
    userTraceColor = (userDoc.exists() && userDoc.data().traceColor) || 'violet';
    _applyTraceColor(userTraceColor);
    _renderTraceColorPicker();
    updatePremiumUI();
    // Retry après 800ms pour couvrir les cas où le DOM n'est pas encore stable
    setTimeout(() => updatePremiumUI(), 800);
    _renderPricingCards();
    await _waitMinIntroDisplay();
    showScreen('screenRadar');
    setNav('nav-radar');
    // Fantôme garanti au 1er lancement — décalé après le GPS
    setTimeout(() => _seedWelcomeGhost(), 4000);
    // ── Présence passive — GPS watch ─────────────────────────────────
    // On (ré)enregistre TOUJOURS le callback riche ici, même si le watch GPS
    // a déjà démarré côté invité (anonyme → authentifié) : sinon, après une
    // inscription, l'utilisateur restait bloqué sur le callback "pauvre" de
    // _ensureLocationReady (pas de vibration/glow de proximité, pas de
    // registerPresence, pas de recentrage) — window._locationWatchStarted
    // restait déjà à true et empêchait ce bloc de s'exécuter. startWatch()
    // est idempotent (no-op si déjà démarré) ; _locationUnsub() retire
    // proprement l'abonnement précédent avant d'en poser un nouveau, plutôt
    // que d'empiler les deux callbacks (LocationService utilise un Set
    // d'abonnés — les deux tourneraient sinon en même temps).
    if (await _maybeShowLocationPrimer()) {
      window._locationWatchStarted = true;
      LocationService.startWatch();
      if (window._locationUnsub) window._locationUnsub();
      let _firstAccuratePosition = false;
      window._locationUnsub = LocationService.onPositionUpdate(({ lat, lng, accuracy, error }) => {
      if (error) { _handleGeoWatchError(error); return; }
      // Ignorer les positions trop imprécises (IP-based = Paris, accuracy > 5000m)
      if (accuracy && accuracy > 5000) return;
      // Recentrer la carte si c'est la première position réelle reçue
      if (!userLat && window.map) {
        window.map.setView([lat, lng], 16);
      }
      userLat = lat; userLng = lng;
      // Recharger les fantômes à la première position GPS précise
      // SEULEMENT si on utilisait le fallback centre-France
      if (!_firstAccuratePosition) {
        _firstAccuratePosition = true;
        if (window._gpsIsFallback) {
          loadNearbyGhosts();
        }
        // Recentrer la carte si elle est déjà ouverte
        if (window.map) window.map.setView([lat, lng], 16);
      }
      const toUpdate = LocationService.detectNearbyPresence(lat, lng, nearbyGhosts);
      toUpdate.forEach(ghostId => {
        LocationService.markPresenceRecorded(ghostId);
        WorldService.registerPresence(ghostId, false).catch(() => {});
      });
      // Effets de proximité sur les fantômes visibles
      nearbyGhosts.forEach(g => {
        const dist = distanceMeters(lat, lng, g.lat, g.lng);
        g.distance = dist;
        const card = document.querySelector(`[onclick*="${g.id}"]`);
        if (!card) return;
        // Mise à jour live de la distance affichée sans re-render
        const distEl = card.querySelector('.envelope-dist');
        if (distEl) {
          distEl.textContent = formatDistance(dist);
          if (dist <= 50) {
            distEl.style.cssText = 'background:rgba(var(--accent-green-rgb),.1);border:1px solid rgba(var(--accent-green-rgb),.25);color:rgba(var(--accent-green-rgb),.9);';
          } else if (dist <= 200) {
            distEl.style.cssText = 'background:rgba(var(--premium-rgb),.08);border:1px solid rgba(var(--premium-rgb),.2);color:rgba(var(--premium-rgb),.8);';
          } else {
            distEl.style.cssText = 'background:rgba(var(--ghost-blue-rgb),.08);border:1px solid rgba(var(--ghost-blue-rgb),.12);color:rgba(var(--ghost-blue-rgb),.6);';
          }
        }
        if (dist <= 10) {
          card.style.boxShadow = '0 0 24px rgba(var(--ghost-blue-rgb),.45)';
          card.style.borderColor = 'rgba(var(--ghost-blue-rgb),.7)';
          card.classList.add('ghost-envelope-close');
          if (navigator.vibrate && !g._buzzed10) { navigator.vibrate([20, 40, 20]); g._buzzed10 = true; }
        } else if (dist <= 30) {
          card.style.boxShadow = '0 0 14px rgba(var(--ghost-blue-rgb),.25)';
          card.style.borderColor = 'rgba(var(--ghost-blue-rgb),.45)';
          card.classList.remove('ghost-envelope-close');
          g._buzzed10 = false;
        } else if (dist <= 100) {
          card.style.boxShadow = '0 0 6px rgba(var(--ghost-blue-rgb),.1)';
          card.style.borderColor = '';
          card.classList.remove('ghost-envelope-close');
        } else {
          card.style.boxShadow = '';
          card.style.borderColor = '';
          card.classList.remove('ghost-envelope-close');
          g._buzzed10 = false;
        }
      }); // fin nearbyGhosts.forEach
    }); // fin onPositionUpdate
    } // fin guard _locationWatchStarted
    document.getElementById('bottomNav').style.display = 'flex';
    // Obtenir la position GPS réelle avant de charger les fantômes
    // (seulement si le priming a été accepté — sinon on diffère, cf. _maybeShowLocationPrimer)
    if (window._locationWatchStarted) {
      try {
        await getLocation();
        if (window.map) window.map.setView([userLat, userLng], 16);
      } catch(e) {
        // GPS refusé ou timeout — garder fallback
      }
    }
    await loadNearbyGhosts();
    // Vérifier les notifications de réponses au démarrage
    setTimeout(() => checkReplyNotifications(), 2000);
    setTimeout(() => checkMemoryAnniversaries(), 3000);
    // Vérifier si un profil public est demandé dans l'URL
    setTimeout(() => checkPublicProfileParam(), 1000);
    // Synchroniser les découvertes depuis Firestore (multi-appareils)
    syncDiscoveriesFromFirestore();
  } else {
    currentUser = null;
    document.getElementById('bottomNav').style.display = 'none';
    // Auth anonyme silencieuse — l'utilisateur voit le radar en lecture seule
    // sans aucune action de sa part. L'inscription est demandée à la première
    // interaction (clic sur fantôme ou dépôt).
    try {
      await signInAnonymously(auth);
      // onAuthStateChanged se re-déclenche avec l'user anonyme → traité dans le bloc isAnonymous ci-dessus
    } catch(e) {
      // Fallback si signInAnonymously échoue (réseau coupé, etc.)
      if (localStorage.getItem('ghostub_onboard_seen')) {
        showScreen('screenAuth');
      } else {
        showScreen('screenOnboard');
      }
    }
  }
});

// ── Afficher/masquer mot de passe (icône œil, cohérente avec les icônes de nav) ──
const _EYE_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const _EYE_OFF_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.9 17.9 0 0 1-4.15 4.9M6.6 6.6C3.4 8.6 2 12 2 12s3.6 7 10 7a10.4 10.4 0 0 0 4.15-.85"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

window.togglePasswordVisibility = (inputId, btn) => {
  const input = document.getElementById(inputId);
  if (!input) return;
  const willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  btn.innerHTML = willShow ? _EYE_OFF_SVG : _EYE_SVG;
  const key = willShow ? 'auth_hide_password' : 'auth_show_password';
  btn.setAttribute('data-i18n-aria-label', key);
  btn.setAttribute('aria-label', t[key]);
};

// ── Mot de passe oublié — jamais révéler si le compte existe ──
window.forgotPassword = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('warning', t.auth_forgot_need_email); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('info', t.auth_forgot_sent, 5000);
  } catch (e) {
    // auth/user-not-found, auth/invalid-email : toast neutre, ne pas révéler l'existence du compte
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email') {
      showToast('info', t.auth_forgot_sent, 5000);
      return;
    }
    // Vraie panne (réseau, quota Firebase…) : le dire — sinon l'utilisateur croit
    // l'email envoyé alors que rien n'est parti.
    showToast('error', t.auth_forgot_failed, 5000);
  }
};

window.register = async () => {
  const pseudo = document.getElementById('regPseudo').value.trim();
  const email  = document.getElementById('regEmail').value.trim();
  const pass   = document.getElementById('regPass').value;
  const err    = document.getElementById('regAuthError');
  if (!pseudo || !email || !pass) { err.textContent = t.auth_err_fields; return; }
  // Validation basique côté client
  if (pass.length < 6) { err.textContent = t.auth_err_short_pass; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = t.auth_err_email; return; }
  if (pseudo.length < 2 || pseudo.length > 30) { err.textContent = t.auth_err_pseudo_len; return; }
  err.textContent = '';
  const btn = document.getElementById('registerBtn') || document.querySelector('#screenRegister button[type=submit], #screenRegister .btn-primary');
  setLoading(btn, true);
  try {
    let registeredUser;
    if (_isGuestUser()) {
      // Lier le compte anonyme au compte réel — préserve toutes les données accumulées
      const credential = EmailAuthProvider.credential(email, pass);
      const result = await linkWithCredential(currentUser, credential);
      registeredUser = result.user;
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      registeredUser = cred.user;
    }
    await updateProfile(registeredUser, { displayName: pseudo });
    Analytics.track('register');
  } catch(e) {
    setLoading(btn, false);
    console.error('register error:', e);
    err.textContent = (e.code === 'auth/email-already-in-use' || e.code === 'auth/credential-already-in-use')
      ? t.auth_err_email_used
      : e.code === 'auth/weak-password' ? t.auth_err_short_pass
      : (e.code === 'auth/network-request-failed' || e.code === 'auth/too-many-requests') ? t.auth_err_network
      : t.auth_err_generic;
  }
};

window.login = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const err   = document.getElementById('loginAuthError');
  err.textContent = '';
  if (!email || !pass) { err.textContent = t.auth_err_fields; return; }
  const btn = document.querySelector('#tabLogin .btn-primary');
  if (btn) { btn.textContent = t.auth_loading || 'Connexion…'; btn.disabled = true; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    Analytics.track('login');
  } catch(e) {
    console.warn('login error:', e);
    // Même mapping que register() (audit 2.2) : ne pas affirmer "mot de passe
    // incorrect" sur une panne réseau/rate-limit — un utilisateur avec les
    // bons identifiants mais une connexion instable se voyait dire le
    // contraire, l'incitant à tort à réinitialiser son mot de passe.
    err.textContent = (e.code === 'auth/network-request-failed' || e.code === 'auth/too-many-requests')
      ? t.auth_err_network
      : t.auth_err_wrong;
    if (btn) { btn.textContent = t.auth_login_btn; btn.disabled = false; }
  }
};

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/ghostub/sw2.js');
    window._swReg = reg;

    // Détection des mises à jour du SW
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      window._swNewWorker = newWorker;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nouvelle version disponible
          window._swReg = reg;
          showUpdateBanner();
        }
      });
    });

    return reg;
  } catch(e) {
    console.warn('SW:', e);
    return null;
  }
}

function showUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) {
    banner.style.display = 'flex';
    Analytics.track('update_available');
  }
}

window._swReg = null; // garder une référence globale

window.applyUpdate = () => {
  const doReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', Date.now());
    window.location.replace(url.toString());
  };
  // Recharger dès que le controller change
  navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
  // Fallback absolu après 4s
  const fallback = setTimeout(doReload, 4000);
  // Essayer dans l'ordre : newWorker → reg.waiting → doReload direct
  const skip = (worker) => {
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      clearTimeout(fallback);
      doReload();
    }
  };
  if (window._swNewWorker) {
    skip(window._swNewWorker);
  } else if (window._swReg && window._swReg.waiting) {
    skip(window._swReg.waiting);
  } else {
    navigator.serviceWorker.ready.then(reg => skip(reg.waiting));
  }
};

async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  Analytics.track('notif_permission', { result: perm });
  return perm === 'granted';
}

function showNotif(title, body) {
  if (!('serviceWorker' in navigator)) return;
  // La Notification système n'interprète jamais le HTML (contrairement au toast
  // in-app qui utilise innerHTML) — on nettoie ici une fois pour toutes, pour que
  // titre et corps restent lisibles même si le texte source contient des balises <b>.
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title.replace(/<[^>]*>/g, ''), {
      body: body.replace(/<[^>]*>/g, ''),
      icon: '/ghostub/icon-maskable-512.png',
      tag: 'fantome-' + Date.now(),
      vibrate: [200, 100, 200],
      data: { url: '/ghostub/' }
    });
  });
}

let notifCheckedGhosts = new Set();
let _checkNewGhostsTimer = null;
let _lastNotifTime = 0; // anti-spam : max 1 notif toutes les 10 min
async function checkNewGhosts() {
  if (!currentUser || !userLat) return;
  // FIX: Debounce — ne pas appeler plus d'une fois par minute
  if (_checkNewGhostsTimer) return;
  _checkNewGhostsTimer = setTimeout(() => { _checkNewGhostsTimer = null; }, 60000);
  try {
    const snap = await WorldService.getVisibleGhosts(userLat, userLng);
    snap.forEach(d => {
      const g = { id: d.id, ...d.data() };
      if (notifCheckedGhosts.has(g.id)) return;
      if (isExpired(g)) return;
      if (!g.lat || !g.lng) return;
      const dist = distanceMeters(userLat, userLng, g.lat, g.lng);
      if (dist <= 5000) {
        notifCheckedGhosts.add(g.id);
        if (g.createdAt && (Date.now() - g.createdAt.seconds * 1000) < 600000) {
          const _now = Date.now();
          if (_now - _lastNotifTime > 600000) {
            _lastNotifTime = _now;
            showNotif(t.notif_new_ghost_title, `À ${formatDistance(dist)} de vous — ${escapeHTML(g.location || t.detail_location_unknown)}`);
          }
        }
      }
    });
  } catch(e) {
    console.warn('checkNewGhosts error:', e);
  }
}

// FIX: Guard contre les appels concurrents
let _checkResonancesRunning = false;
async function checkResonances() {
  if (!currentUser || _checkResonancesRunning) return;
  _checkResonancesRunning = true;
  try {
    const myGhosts = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid', '==', currentUser.uid), limit(50)));
    myGhosts.forEach(d => {
      const g = d.data();
      const prev = parseInt(localStorage.getItem('prev_reso_' + d.id) || '0');
      const curr = g.resonances || 0;
      if (curr > prev) {
        const lieu = escapeHTML(g.location || 'ce lieu');
        const msg = _resoMessage(lieu, curr);
        showNotif(t.notif_reso_title, msg);
        showToast('info', msg, 5000);
        localStorage.setItem('prev_reso_' + d.id, curr);
      }
    });
  } catch(e) {
    console.warn('checkResonances error:', e);
  } finally {
    _checkResonancesRunning = false;
  }
}

function _resoMessage(lieu, total) {
  const messages_fr = [
    `Quelqu'un à <b>${lieu}</b> a été touché par ce que vous avez laissé là.`,
    `Une âme est passée à <b>${lieu}</b> — votre trace a résonné en elle.`,
    `À <b>${lieu}</b>, quelqu'un a senti que ce message existait.`,
    `Votre fantôme de <b>${lieu}</b> n'est plus seul — quelqu'un l'a entendu.`,
    `Un inconnu à <b>${lieu}</b> a résonné avec vos mots.`,
  ];
  const messages_en = [
    `Someone at <b>${lieu}</b> was moved by what you left there.`,
    `A soul passed by <b>${lieu}</b> — your trace resonated within them.`,
    `At <b>${lieu}</b>, someone felt this message existed.`,
    `Your ghost at <b>${lieu}</b> is no longer alone — someone heard it.`,
    `A stranger at <b>${lieu}</b> resonated with your words.`,
  ];
  const messages = _currentLang === 'en' ? messages_en : messages_fr;
  return messages[total % messages.length];
}

async function checkDiscoveries() {
  if (!currentUser) return;
  try {
    const snap = await getDocs(query(
      collection(db, COLL.DISCOVERIES),
      where('authorUid', '==', currentUser.uid),
      where('notified', '==', false)
    ));
    for (const d of snap.docs) {
      const disc = d.data();
      showNotif(
        t.notif_disc_title,
        `${escapeHTML(disc.discoveredBy)} a découvert votre fantôme à "${escapeHTML(disc.ghostLocation)}"`
      );
      updateDoc(doc(db, COLL.DISCOVERIES, d.id), { notified: true }).catch(() => {});
    }
  } catch(e) { console.warn('[ghostub:checkDiscoveries]', e); }
}

// ── NOTIFICATION RÉTENTION — FANTÔME JAMAIS OUVERT ───────
let _lastVirginNotif = 0;

// ══════════════════════════════════════════════════════════
// NOTIFICATIONS INTELLIGENTES
// ══════════════════════════════════════════════════════════

// ── 1. Limite globale : 2 notifs push max par jour ────────
const _NOTIF_DAILY_KEY = () => 'ghostub_notif_daily_' + new Date().toISOString().slice(0,10)
  + (currentUser ? '_' + currentUser.uid : '');

function _canSendNotif() {
  const key = _NOTIF_DAILY_KEY();
  const count = parseInt(localStorage.getItem(key) || '0');
  return count < 2;
}

function _recordNotifSent() {
  const key = _NOTIF_DAILY_KEY();
  const count = parseInt(localStorage.getItem(key) || '0');
  localStorage.setItem(key, count + 1);
}

// Wrapper autour de showNotif qui respecte la limite
function _smartNotif(title, body) {
  if (!_canSendNotif()) return; // quota journalier atteint
  showNotif(title, body);
  _recordNotifSent();
}

// ── 2. Lieu fréquenté — "Tu passes souvent par ici" ───────
const _FREQ_PLACES_KEY = () => currentUser ? 'ghostub_freq_' + currentUser.uid : null;

function _trackFrequentPlace(geohash5) {
  const key = _FREQ_PLACES_KEY();
  if (!key || !geohash5) return;
  let data;
  try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { data = {}; }

  const today = new Date().toISOString().slice(0,10);
  if (!data[geohash5]) data[geohash5] = { visits: [], lastNotif: '' };

  // Ajouter visite du jour si pas déjà enregistrée aujourd'hui
  if (!data[geohash5].visits.includes(today)) {
    data[geohash5].visits.push(today);
    // Garder seulement les 30 derniers jours
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10);
    data[geohash5].visits = data[geohash5].visits.filter(d => d >= cutoff);
  }

  const visitCount = data[geohash5].visits.length;
  const lastNotif  = data[geohash5].lastNotif || '';
  const weekAgo    = new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10);

  // Seuil : 3+ visites sur 30j ET notif pas envoyée cette semaine
  if (visitCount >= 3 && lastNotif < weekAgo) {
    // Y a-t-il un fantôme récent non ouvert par cet utilisateur dans ce geohash ?
    const freshGhost = nearbyGhosts.find(g =>
      g.geohash === geohash5 &&
      (!g.openCount || g.openCount === 0) &&
      g.authorUid !== currentUser?.uid
    );
    if (freshGhost) {
      const lieu = freshGhost.location || 'ce lieu';
      const msg = _currentLang === 'en'
        ? `You come here often. Someone left something for you at "${lieu}".`
        : `Tu passes souvent par ici. Quelqu'un t'a laissé quelque chose à "${lieu}".`;
      showToast('info', msg, 7000);
      _smartNotif('👻 ' + (freshGhost.emoji || ''), msg);
      data[geohash5].lastNotif = today;
    }
  }

  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('[ghostub:_trackFrequentPlace]', e); }
}

function checkVirginGhostNearby() {
  if (!currentUser || nearbyGhosts.length === 0) return;
  // Max 1 fois par heure
  if (Date.now() - _lastVirginNotif < 3600000) return;
  // Chercher le fantôme jamais ouvert le plus vieux à moins de 500m
  const candidates = nearbyGhosts.filter(g =>
    (!g.openCount || g.openCount === 0) && g.distance <= 500 && g.createdAt
  );
  if (candidates.length === 0) return;
  // Le plus vieux en premier
  candidates.sort((a, b) => (a.createdAt.seconds || 0) - (b.createdAt.seconds || 0));
  const ghost = candidates[0];
  const ageDays = Math.floor((Date.now() - ghost.createdAt.seconds * 1000) / 86400000);
  const dist = formatDistance(ghost.distance);
  let msg;
  if (ageDays > 365) {
    const yrs = Math.floor(ageDays/365);
    msg = t.notif_virgin_1yr.replace('{dist}', dist).replace('{n}', yrs).replace('{s}', yrs > 1 ? 's' : '');
  } else if (ageDays > 30) {
    msg = t.notif_virgin_30d.replace('{dist}', dist).replace('{n}', ageDays);
  } else {
    msg = t.notif_virgin_new.replace('{dist}', dist);
  }
  // Toast toujours visible
  showToast('info', msg, 6000);
  // Notif push — seulement si quota pas atteint
  const ghostEmoji = ghost.emoji || '👻';
  const pushTitle  = _currentLang === 'en'
    ? `${ghostEmoji} Never opened — be the first`
    : `${ghostEmoji} Jamais ouvert — sois le premier`;
  _smartNotif(pushTitle, msg);
  _lastVirginNotif = Date.now();
}

// ── NOTIFIER UTILISATEURS PROCHES lors d'un nouveau dépôt ────────────
async function _notifyNearbyUsers(newGhostId, lat, lng, location) {
  if (!currentUser) return;
  // Chercher des fantômes dans un rayon ~150m (delta lat/lng ~0.0014°)
  const delta = 0.0014;
  const snap = await getDocs(query(
    collection(db, COLL.GHOSTS),
    where('lat', '>=', lat - delta),
    where('lat', '<=', lat + delta),
    limit(20)
  ));
  const notified = new Set();
  notified.add(currentUser.uid); // ne pas se notifier soi-même
  for (const d of snap.docs) {
    const g = d.data();
    if (!g.authorUid || notified.has(g.authorUid)) continue;
    // Vérifier aussi longitude (Firestore ne filtre que sur lat)
    if (Math.abs((g.lng || 0) - lng) > delta * 2) continue;
    notified.add(g.authorUid);
    await addDoc(collection(db, COLL.NOTIFS), {
      type: 'nearby_new',
      toUid: g.authorUid,
      ghostId: newGhostId,
      // theirGhostId : le fantôme du destinataire qui a matché la recherche de
      // proximité — permet à firestore.rules de vérifier une vraie proximité
      // entre les deux fantômes plutôt que de faire confiance à toUid seul
      // (cf. Audit-5).
      theirGhostId: d.id,
      ghostLocation: location,
      notified: false,
      createdAt: serverTimestamp()
    }).catch(() => {});
  }
}

// Verbe d'impact associé à chaque emoji de réaction rapide — fait le pont entre
// la donnée brute (REPLIES) et un retour émotionnel lisible pour le déposant.
const _REACTION_VERBS = {
  '😂': { fr: 'a fait rire quelqu\'un',     en: 'made someone laugh' },
  '😢': { fr: 'a fait pleurer quelqu\'un',  en: 'made someone cry' },
  '🥹': { fr: 'a touché quelqu\'un',        en: 'touched someone' },
  '🤨': { fr: 'a intrigué quelqu\'un',      en: 'intrigued someone' },
  '😮': { fr: 'a surpris quelqu\'un',       en: 'surprised someone' },
  '❤️': { fr: 'a été aimé',                 en: 'was loved' },
};
function _reactionVerb(rc) {
  const entry = _REACTION_VERBS[(rc || '').trim()];
  if (!entry) return null;
  return _currentLang === 'en' ? entry.en : entry.fr;
}

// ══════════════════════════════════════════════════════════
// ANNIVERSAIRE / NOSTALGIE — un fantôme déposé refait surface
// ══════════════════════════════════════════════════════════
// Paliers volontairement rapprochés (1 mois / 3 mois / 6 mois / 1 an) car le
// projet est encore jeune — inutile d'attendre 365 jours pour que ça ait un effet.
const ANNIV_MILESTONES = [
  { days: 30,  fr: 'Il y a 1 mois',  en: '1 month ago' },
  { days: 90,  fr: 'Il y a 3 mois',  en: '3 months ago' },
  { days: 180, fr: 'Il y a 6 mois',  en: '6 months ago' },
  { days: 365, fr: 'Il y a 1 an',    en: '1 year ago' },
];
const _ANNIV_CHECK_KEY = () => 'ghostub_anniv_checked_' + new Date().toISOString().slice(0,10) + (currentUser ? '_' + currentUser.uid : '');
const _ANNIV_NOTIFIED_KEY = () => currentUser ? 'ghostub_anniv_notified_' + currentUser.uid : null;

async function checkMemoryAnniversaries() {
  if (!currentUser) return;
  if (localStorage.getItem(_ANNIV_CHECK_KEY())) return; // déjà vérifié aujourd'hui
  localStorage.setItem(_ANNIV_CHECK_KEY(), '1');
  const key = _ANNIV_NOTIFIED_KEY();
  if (!key) return;
  try {
    let notified;
    try { notified = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { notified = []; }

    const snap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      limit(100)
    ));
    const now = Date.now();
    for (const d of snap.docs) {
      const g = d.data();
      if (!g.createdAt) continue;
      const daysSince = Math.floor((now - g.createdAt.seconds * 1000) / 86400000);
      // Prendre le plus grand palier atteint et pas encore notifié pour ce fantôme
      const eligible = ANNIV_MILESTONES.filter(m => daysSince >= m.days && !notified.includes(d.id + '_' + m.days));
      if (eligible.length === 0) continue;
      const milestone = eligible[eligible.length - 1];
      const lieu = escapeHTML(g.location || t.detail_location_unknown);
      const when = _currentLang === 'en' ? milestone.en : milestone.fr;
      const title = _currentLang === 'en' ? '🕯️ A memory resurfaces' : '🕯️ Un souvenir refait surface';
      const msg = _currentLang === 'en'
        ? `${when}, you left a trace at ${lieu}. It's still there.`
        : `${when}, tu laissais une trace à ${lieu}. Elle est toujours là.`;
      _smartNotif(title, msg);
      showToast('info', msg, 6000);
      // Marquer ce palier ET les paliers plus petits comme notifiés (pas de redite plus tard)
      ANNIV_MILESTONES.forEach(m => { if (m.days <= milestone.days) notified.push(d.id + '_' + m.days); });
      break; // une seule resurgence par vérification, pour rester discret
    }
    localStorage.setItem(key, JSON.stringify(notified));
  } catch(e) { console.warn('[ghostub:checkMemoryAnniversaries]', e); }
}

async function checkReplyNotifications() {
  if (!currentUser) return;
  try {
    const snap = await getDocs(query(
      collection(db, COLL.NOTIFS),
      where('toUid', '==', currentUser.uid),
      where('notified', '==', false),
      limit(10)
    ));
    for (const d of snap.docs) {
      const n = d.data();
      const lieu = escapeHTML(n.ghostLocation || 'ce lieu');
      let title, msg;
      if (n.type === 'reply') {
        title = t.notif_reply_title;
        const rc = (n.reactionContent || '').trim();
        const verb = _reactionVerb(rc);
        if (verb) {
          // Réaction emoji reconnue — feedback émotionnel précis
          msg = _currentLang === 'en'
            ? `Your trace at <b>${lieu}</b> ${verb}.`
            : `Ton fantôme de <b>${lieu}</b> ${verb}.`;
        } else if (rc) {
          // Réaction texte (micro-réponse ou ancien écran reply) — on cite le contenu
          msg = _currentLang === 'en'
            ? `${escapeHTML(n.fromAuthor || 'Someone')} reacted to your trace at <b>${lieu}</b>: “${escapeHTML(rc)}”`
            : `${escapeHTML(n.fromAuthor || 'Un inconnu')} a réagi à ton fantôme de <b>${lieu}</b> : « ${escapeHTML(rc)} »`;
        } else {
          // Fallback (anciennes notifs sans reactionContent)
          msg = `${escapeHTML(n.fromAuthor || 'Un inconnu')} a laissé une réponse à votre fantôme de <b>${lieu}</b>.`;
        }
      } else if (n.type === 'biz_open') {
        title = '🏪 Un client a vu votre offre !';
        msg = _currentLang === 'en' ? `Someone just discovered your commerce offer at <b>${lieu}</b>.` : `Quelqu'un vient de découvrir votre offre commerce à <b>${lieu}</b>.`;
      } else if (n.type === 'open') {
        const openMsgs = [
          ..._currentLang === 'en' ? [
            `Someone just broke the seal of your trace at <b>${lieu}</b>.`,
            `A stranger opened your envelope at <b>${lieu}</b> — your message exists.`,
            `Your ghost at <b>${lieu}</b> was discovered for the first time.`,
          ] : [
            `Quelqu'un vient de briser le sceau de votre trace à <b>${lieu}</b>.`,
            `Un inconnu a ouvert votre enveloppe à <b>${lieu}</b> — votre message existe.`,
            `Votre fantôme de <b>${lieu}</b> a été découvert pour la première fois.`,
          ],
        ];
        const hash = (n.ghostId || '').length % openMsgs.length;
        title = t.notif_open_title;
        msg = openMsgs[hash];
      } else if (n.type === 'nearby_new') {
        title = t.notif_nearby_title;
        const lieu = escapeHTML(n.ghostLocation || 'un lieu que vous connaissez');
        msg = `Un inconnu vient de laisser une trace à <b>${lieu}</b> — un endroit où vous avez déjà été.`;
      } else continue;
      showNotif(title, msg);
      showToast('info', msg, 5000);
      updateDoc(doc(db, COLL.NOTIFS, d.id), { notified: true }).catch(() => {});
    }
  } catch(e) { console.warn('[ghostub:checkReplyNotifications]', e); }
}

// ── NOTIFICATION PUSH VIA SW (app en arrière-plan) ───────
function sendSwNotifIfNeeded() {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem('notif_enabled') !== '1') return;
  if (!nearbyGhosts || nearbyGhosts.length === 0) return;
  // Chercher un fantôme jamais ouvert et proche
  const candidates = nearbyGhosts.filter(g =>
    (!g.openCount || g.openCount === 0) && g.distance <= 300
  );
  if (candidates.length === 0) return;
  // Max 1 push par heure
  const lastPush = parseInt(localStorage.getItem('ghostub_last_sw_push') || '0');
  if (Date.now() - lastPush < 3600000) return;
  localStorage.setItem('ghostub_last_sw_push', Date.now());
  const g = candidates[0];
  const dist = formatDistance(g.distance);
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({
      type: 'NOTIFY_NEARBY',
      title: t.notif_nearby_sw_title,
      body: t.notif_nearby_sw_body.replace('{dist}', dist),
      tag: 'fantome-nearby-bg'
    });
  });
}

// Envoyer la notif quand l'utilisateur quitte l'app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendSwNotifIfNeeded();
});

let _visibilityListenerAdded = false;

let _notifIntervalsStarted = false;
let _notifIntervalIds = [];
function _stopNotifIntervals() {
  _notifIntervalIds.forEach(id => clearInterval(id));
  _notifIntervalIds = [];
  _notifIntervalsStarted = false;
}
function _startNotifIntervals() {
  if (_notifIntervalsStarted) return; // déjà démarrés, pas de doublon
  _notifIntervalsStarted = true;
  _notifIntervalIds.push(setInterval(checkNewGhosts, 5 * 60 * 1000));
  _notifIntervalIds.push(setInterval(checkResonances, 10 * 60 * 1000));
  _notifIntervalIds.push(setInterval(checkDiscoveries, 3 * 60 * 1000));
  _notifIntervalIds.push(setInterval(checkReplyNotifications, 2 * 60 * 1000));
  // Vérifier au retour dans l'appli — un seul listener
  if (!_visibilityListenerAdded) {
    _visibilityListenerAdded = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Reprendre les intervals suspendus
        if (!_notifIntervalsStarted) _startNotifIntervals();
        setTimeout(() => {
          checkNewGhosts();
          checkDiscoveries();
          checkReplyNotifications();
          checkVirginGhostNearby();
        }, 1500);
      } else {
        // Suspendre les intervals quand l'app passe en arrière-plan
        _stopNotifIntervals();
      }
    });
  }
}

function _setNotifBtnState(active) {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  const span = btn.querySelector('span:nth-child(2)');
  if (active) {
    if (span) span.textContent = t.profile_notif_on;
    btn.style.color = 'rgba(var(--accent-green-rgb),.9)';
  } else {
    if (span) span.textContent = t.profile_notif_off;
    btn.style.color = ''; // retombe sur color:var(--warm) défini par .settings-row-btn
  }
}

window.enableNotifications = async () => {
  // Fix mobile : relâcher le focus/active state immédiatement
  document.activeElement?.blur();
  const btn = document.getElementById('notifBtn');
  const isEnabled = localStorage.getItem('notif_enabled') === '1';

  if (isEnabled) {
    // Toggle OFF — on utilise uniquement localStorage comme source de vérité
    localStorage.removeItem('notif_enabled');
    _setNotifBtnState(false);
    btn.style.borderColor = '';
    showToast('info', t.profile_notif_disabled);
    return;
  }

  // Permission bloquée par le navigateur
  if (Notification.permission === 'denied') {
    showToast('warning', t.profile_notif_blocked, 5000);
    return;
  }

  // Activer
  const alreadyGranted = Notification.permission === 'granted';
  const granted = alreadyGranted ? true : await requestNotifPermission();
  if (granted) {
    _setNotifBtnState(true);
    btn.style.borderColor = 'rgba(var(--accent-green-rgb),.4)';
    localStorage.setItem('notif_enabled', '1');
    showToast('success', t.profile_notif_enabled);
    _startNotifIntervals();
    checkDiscoveries();
  } else {
    const span4 = btn.querySelector('span:nth-child(2)'); if (span4) span4.textContent = t.profile_notif_denied || 'Notifications refusées';
    btn.style.borderColor = 'rgba(255,100,100,.3)';
    btn.style.color = 'rgba(255,100,100,.7)';
    showToast('warning', t.profile_notif_denied, 5000);
  }
};

// ── Prompt push post-dépôt ────────────────────────────────
// Affiché sur l'overlay de succès uniquement si la permission
// n'a pas encore été demandée (ni accordée, ni refusée).
function _maybeShowSuccessNotifPrompt() {
  const btn = document.getElementById('successNotifBtn');
  if (!btn) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  // Apparaît 0.9 s après l'overlay (après les animations de titre/sous-titre)
  setTimeout(() => {
    btn.style.display = 'block';
    btn.style.animation = 'fadeUp .4s ease both';
  }, 900);
}

window._requestSuccessNotif = async (e) => {
  e.stopPropagation(); // ne pas déclencher le dismiss de l'overlay
  const btn = document.getElementById('successNotifBtn');
  if (!btn) return;
  btn.disabled = true;
  const granted = await requestNotifPermission();
  if (granted) {
    localStorage.setItem('notif_enabled', '1');
    _startNotifIntervals();
    checkDiscoveries();
    btn.textContent = t.dep_notif_ok;
    btn.style.color = 'rgba(var(--accent-green-rgb),.9)';
    btn.style.borderColor = 'rgba(var(--accent-green-rgb),.3)';
    btn.style.background = 'rgba(var(--accent-green-rgb),.08)';
    btn.style.cursor = 'default';
  } else {
    // Permission refusée ou dismissed : faire disparaître discrètement
    btn.style.opacity = '0';
    setTimeout(() => { btn.style.display = 'none'; }, 300);
  }
};

registerServiceWorker().then(reg => {
  if (reg && localStorage.getItem('notif_enabled') === '1' && Notification.permission === 'granted') {
    _startNotifIntervals();
    const btn = document.getElementById('notifBtn');
    if (btn) {
      _setNotifBtnState(true);
      btn.style.borderColor = 'rgba(var(--accent-green-rgb),.4)';
    }
  }
});

window.toggleRecording = async () => {
  if (isRecording) { stopRecording(); } else { startRecording(); }
};

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      showAudioPreview(blob);
    };
    mediaRecorder.start();
    isRecording = true;
    const btn = document.getElementById('recordBtn');
    btn.classList.add('recording');
    btn.setAttribute('aria-label', "Arrêter l'enregistrement");
    document.getElementById('recordLabel').textContent = "⏹ Arrêter l'enregistrement";
    let secs = 0;
    const timer = document.getElementById('recordTimer');
    recordingInterval = setInterval(() => {
      secs++;
      const m = Math.floor(secs / 60).toString().padStart(2,'0');
      const s = (secs % 60).toString().padStart(2,'0');
      timer.textContent = m + ':' + s;
      if (secs >= 60) stopRecording();
    }, 1000);
    Analytics.track('record_start');
  } catch(e) {
    document.getElementById('depositError').textContent = t.dep_mic_denied;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  clearInterval(recordingInterval);
  const btn = document.getElementById('recordBtn');
  btn.classList.remove('recording');
  btn.setAttribute('aria-label', 'Enregistrer un message vocal');
  document.getElementById('recordLabel').textContent = 'Enregistrer un message vocal';
}

function showAudioPreview(blob) {
  // FIX: Révoquer l'ancien blob URL s'il existe
  if (window._pendingAudioBlobUrl) {
    URL.revokeObjectURL(window._pendingAudioBlobUrl);
  }
  const url = URL.createObjectURL(blob);
  window._pendingAudioBlobUrl = url;
  const preview = document.getElementById('audioPreview');
  preview.innerHTML = `
    <div class="dep-preview-audio-row">
      <span class="dep-preview-audio-icon" aria-hidden="true">🎙</span>
      <audio controls src="${url}" class="dep-preview-audio-el" aria-label="Aperçu de l'enregistrement vocal"></audio>
      <button data-action="clearAudio" aria-label="Supprimer l'enregistrement" class="dep-preview-clear-btn">✕</button>
    </div>`;
  preview.dataset.blob = 'pending';
  window._pendingAudioBlob = blob;
}

window.clearAudio = () => {
  // FIX: Révoquer le blob URL
  if (window._pendingAudioBlobUrl) {
    URL.revokeObjectURL(window._pendingAudioBlobUrl);
    window._pendingAudioBlobUrl = null;
  }
  document.getElementById('audioPreview').innerHTML = '';
  window._pendingAudioBlob = null;
};

window.triggerPhoto = () => { document.getElementById('photoInput').click(); };
window.triggerPhotoCamera = () => { document.getElementById('photoInputCamera').click(); };
window.triggerPhotoGallery = () => { document.getElementById('photoInputGallery').click(); };

window.handlePhoto = (input) => {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    document.getElementById('depositError').textContent = t.dep_photo_invalid;
    return;
  }
  // Compression canvas avant upload
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200; // px max
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return;
        if (window._pendingPhotoBlobUrl) URL.revokeObjectURL(window._pendingPhotoBlobUrl);
        const url = URL.createObjectURL(blob);
        window._pendingPhotoBlobUrl = url;
        window._pendingPhotoFile = new File([blob], file.name, { type: 'image/jpeg' });
        document.getElementById('photoPreview').innerHTML = `
          <div class="dep-preview-media-wrap">
            <img src="${url}" alt="Aperçu de la photo" class="dep-preview-img" loading="lazy">
            <button data-action="clearPhoto" aria-label="Supprimer la photo" class="dep-preview-clear-btn-overlay">✕</button>
            <div class="dep-preview-size-badge">${(blob.size/1024).toFixed(0)}ko</div>
          </div>`;
        document.getElementById('depositError').textContent = '';
      }, 'image/jpeg', 0.82);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.clearPhoto = () => {
  // FIX: Révoquer le blob URL
  if (window._pendingPhotoBlobUrl) {
    URL.revokeObjectURL(window._pendingPhotoBlobUrl);
    window._pendingPhotoBlobUrl = null;
  }
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('photoInput').value = '';
  window._pendingPhotoFile = null;
};

// ── VIDÉO (Premium) ──────────────────────────────────────
window.triggerVideo = () => {
  if (!isPremium) {
    showToast('info', t.dep_video_locked, 3000);
    return;
  }
  document.getElementById('videoInput').click();
};

window.handleVideo = (input) => {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { showToast('warning', t.dep_video_big); input.value = ''; return; }
  const url = URL.createObjectURL(file);
  if (window._pendingVideoBlobUrl) URL.revokeObjectURL(window._pendingVideoBlobUrl);
  window._pendingVideoBlobUrl = url;
  window._pendingVideoFile = file;
  const preview = document.getElementById('videoPreview');
  preview.innerHTML = `
    <div class="dep-preview-video-wrap">
      <video src="${url}" controls playsinline class="dep-preview-video-el"></video>
      <button data-action="clearVideo" aria-label="Supprimer la vidéo" class="dep-preview-clear-btn-overlay">✕</button>
    </div>`;
  input.value = '';
};

window.clearVideo = () => {
  if (window._pendingVideoBlobUrl) { URL.revokeObjectURL(window._pendingVideoBlobUrl); window._pendingVideoBlobUrl = null; }
  window._pendingVideoFile = null;
  document.getElementById('videoPreview').innerHTML = '';
};

// ── PHASE 1d v103 — GALERIE DE FICHIERS (PDF, JPG, PNG) Premium ─
const ATTACH_MAX_COUNT = 3;
const ATTACH_MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ATTACH_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

window._pendingAttachments = window._pendingAttachments || []; // [{ file, name, type, size, blobUrl }]

function _humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}
function _attachIcon(type) {
  if (type === 'application/pdf') return '📄';
  if (type && type.startsWith('image/')) return '🖼️';
  return '📎';
}
function _renderAttachmentsList() {
  const list = document.getElementById('attachmentsList');
  const wrap = document.getElementById('step3AttachmentsWrap');
  if (!list) return;
  const items = window._pendingAttachments || [];
  list.innerHTML = items.map((a, i) => {
    const isImg = a.type && a.type.startsWith('image/');
    const thumb = isImg && a.blobUrl
      ? `<div class="attachment-thumb"><img src="${a.blobUrl}" alt=""></div>`
      : `<div class="attachment-thumb">${_attachIcon(a.type)}</div>`;
    const safeName = (a.name || 'fichier').replace(/[<>"']/g, '');
    return `<div class="attachment-item">
      ${thumb}
      <div class="attachment-info">
        <div class="attachment-name">${safeName}</div>
        <div class="attachment-meta">${_humanSize(a.size || 0)}</div>
      </div>
      <button type="button" class="attachment-remove" data-action="removeAttachment" data-arg="${i}" aria-label="Retirer ce fichier">✕</button>
    </div>`;
  }).join('');
  if (wrap) wrap.classList.toggle('attachments-full', items.length >= ATTACH_MAX_COUNT);
  const hint = document.getElementById('attachmentsCountHint');
  if (hint) {
    if (items.length === 0) {
      hint.textContent = (t.dep_attach_count_hint || '3 fichiers maximum · 10 Mo chacun');
    } else {
      const left = ATTACH_MAX_COUNT - items.length;
      hint.textContent = left > 0
        ? (left + ' / ' + ATTACH_MAX_COUNT + ' ' + (t.dep_attach_remaining || 'emplacements restants'))
        : (t.dep_attach_full_hint || 'Maximum atteint — retire un fichier pour en ajouter');
    }
  }
}

window.triggerAttachments = () => {
  if (!isPremium) {
    showToast('info', t.dep_attach_locked || t.dep_video_locked || 'Fonctionnalité réservée Premium', 3000);
    return;
  }
  if ((window._pendingAttachments || []).length >= ATTACH_MAX_COUNT) {
    showToast('warning', t.dep_attach_full || 'Maximum 3 fichiers atteints', 2500);
    return;
  }
  document.getElementById('attachmentsInput').click();
};

window.handleAttachments = (input) => {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const current = window._pendingAttachments || [];
  let rejectedSize = 0, rejectedType = 0, rejectedCount = 0;
  for (const file of files) {
    if (current.length >= ATTACH_MAX_COUNT) { rejectedCount++; continue; }
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    if (!ATTACH_ALLOWED_TYPES.includes(type)) { rejectedType++; continue; }
    if (file.size > ATTACH_MAX_SIZE) { rejectedSize++; continue; }
    const isImg = type.startsWith('image/');
    const blobUrl = isImg ? URL.createObjectURL(file) : null;
    current.push({ file, name: file.name, type, size: file.size, blobUrl });
  }
  window._pendingAttachments = current;
  if (rejectedType) showToast('warning', t.dep_attach_wrong_type || 'Format non supporté (PDF, JPG, PNG uniquement)', 3500);
  if (rejectedSize) showToast('warning', t.dep_attach_too_big || 'Fichier trop lourd (max 10 Mo)', 3500);
  if (rejectedCount) showToast('info', t.dep_attach_full || 'Maximum 3 fichiers atteints', 2500);
  input.value = '';
  _renderAttachmentsList();
};

window.removeAttachment = (index) => {
  const items = window._pendingAttachments || [];
  const item = items[index];
  if (!item) return;
  if (item.blobUrl) { try { URL.revokeObjectURL(item.blobUrl); } catch(_) { console.warn('[ghostub:revokeObjectURL]', _); } }
  items.splice(index, 1);
  window._pendingAttachments = items;
  _renderAttachmentsList();
};

window.clearAttachments = () => {
  const items = window._pendingAttachments || [];
  for (const a of items) {
    if (a.blobUrl) { try { URL.revokeObjectURL(a.blobUrl); } catch(_) { console.warn('[ghostub:revokeObjectURL]', _); } }
  }
  window._pendingAttachments = [];
  const list = document.getElementById('attachmentsList');
  if (list) list.innerHTML = '';
  const wrap = document.getElementById('step3AttachmentsWrap');
  if (wrap) wrap.classList.remove('attachments-full');
  _renderAttachmentsList();
};


async function uploadMedia(uid) {
  let audioUrl = null, audioPublicId = null, audioResourceType = null;
  let photoUrl = null, photoPublicId = null, photoResourceType = null;
  let videoUrl = null, videoPublicId = null, videoResourceType = null;

  // FIX: Helper avec retry x2 sur erreur réseau + timeout (AbortController) —
  // sans timeout, un fetch qui stalle sur mobile ne rejette jamais et bloque
  // le dépôt indéfiniment (spinner infini), retry inclus.
  // Retourne { url, publicId, resourceType } — public_id/resource_type sont
  // capturés en plus de secure_url pour permettre la suppression Cloudinary
  // ciblée au moment où le fantôme expire (réconciliation, audit 3.2).
  async function uploadToCloudinary(fd, resourceType, timeoutMs = 30000) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method:'POST', body: fd, signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return { url: data.secure_url || null, publicId: data.public_id || null, resourceType: data.resource_type || null };
      } catch(e) {
        if (attempt === 1) throw e;
        await new Promise(r => setTimeout(r, 1000));
      } finally {
        clearTimeout(timer);
      }
    }
  }

  if (window._pendingAudioBlob) {
    const fd = new FormData();
    fd.append('file', window._pendingAudioBlob, 'audio.webm');
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/audio');
    const r = await uploadToCloudinary(fd, 'video', 30000);
    audioUrl = r.url; audioPublicId = r.publicId; audioResourceType = r.resourceType;
  }
  if (window._pendingPhotoFile) {
    const fd = new FormData();
    fd.append('file', window._pendingPhotoFile);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/photos');
    const r = await uploadToCloudinary(fd, 'image', 30000);
    photoUrl = r.url; photoPublicId = r.publicId; photoResourceType = r.resourceType;
  }
  if (window._pendingVideoFile) {
    const fd = new FormData();
    fd.append('file', window._pendingVideoFile);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/videos');
    const r = await uploadToCloudinary(fd, 'video', 120000);
    videoUrl = r.url; videoPublicId = r.publicId; videoResourceType = r.resourceType;
  }
  // Phase 1d v103 — upload des fichiers joints (PDF + images), max 3
  let attachments = null;
  if (Array.isArray(window._pendingAttachments) && window._pendingAttachments.length > 0) {
    attachments = [];
    for (const a of window._pendingAttachments) {
      try {
        const fd = new FormData();
        fd.append('file', a.file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        fd.append('folder', 'ghostub/files');
        // 'auto' laisse Cloudinary détecter le type (image vs raw pour PDF)
        const r = await uploadToCloudinary(fd, 'auto', 30000);
        if (r.url) attachments.push({ url: r.url, name: a.name, type: a.type, size: a.size, publicId: r.publicId, resourceType: r.resourceType });
      } catch (e) {
        console.warn('attachment upload failed:', a.name, e);
      }
    }
    if (attachments.length === 0) attachments = null;
  }
  return {
    audioUrl, audioPublicId, audioResourceType,
    photoUrl, photoPublicId, photoResourceType,
    videoUrl, videoPublicId, videoResourceType,
    attachments,
  };
}


// ── STREAK DE DÉCOUVERTE ─────────────────────────────────
function _getStreakKey() { return currentUser ? 'ghostub_streak_' + currentUser.uid : 'ghostub_streak_anon'; }
function _getStreak() {
  try { return JSON.parse(localStorage.getItem(_getStreakKey()) || '{"count":0,"lastDate":"","freezeAt":""}'); } catch(e) { return {count:0,lastDate:'',freezeAt:''}; }
}
// Gel de streak (juin 2026) : 1 jour de grâce, utilisable au plus une fois tous les
// 7 jours, pour que rater une seule journée ne casse pas la série — logique Duolingo,
// pensée pour rester encourageante plutôt que punitive.
function _updateStreak() {
  const today = new Date().toISOString().slice(0,10);
  const s = _getStreak();
  if (s.lastDate === today) return s; // déjà mis à jour aujourd'hui
  const yesterday  = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const dayBefore  = new Date(Date.now() - 2 * 86400000).toISOString().slice(0,10);
  const weekAgo    = new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10);
  let newCount, freezeJustUsed = false;
  if (s.lastDate === yesterday || s.lastDate === '') {
    newCount = s.count + 1; // continuité normale (ou toute première action)
  } else if (s.lastDate === dayBefore && (s.freezeAt || '') < weekAgo) {
    newCount = s.count + 1; // 1 jour sauté, gel disponible → la série continue
    freezeJustUsed = true;
  } else {
    newCount = 1; // trop de jours sautés, ou gel déjà utilisé récemment
  }
  const updated = { count: newCount, lastDate: today, freezeAt: freezeJustUsed ? today : (s.freezeAt || '') };
  localStorage.setItem(_getStreakKey(), JSON.stringify(updated));
  updated.freezeJustUsed = freezeJustUsed;
  return updated;
}
function _renderStreak() {
  const s = _getStreak();
  const el = document.getElementById('streakDisplay');
  if (!el) return;
  const weekPlaces = _getWeeklyPlaces();
  // Priorité : lieux de la semaine > jours consécutifs
  if (weekPlaces >= 3) {
    el.textContent = '🔥 ' + weekPlaces + ' lieux';
    el.style.display = 'inline-block';
    el.title = weekPlaces + ' lieux explorés cette semaine';
  } else if (s.count >= 2) {
    el.textContent = '🔥 ' + s.count + 'j';
    el.style.display = 'inline-block';
    el.title = s.count + ' jours consécutifs';
  } else {
    el.style.display = 'none';
  }
}

// ── MILESTONES ──────────────────────────────────────────
const MILESTONES = [1,5,10,25,50,100];
// Résonances (utilisé aussi par _checkResoMilestone plus bas et par
// CARD_TRACKS ci-dessous — déclaré ici pour être disponible avant les deux).
const RESO_MILESTONES = [5, 10, 25, 50, 100];
const RANKS_FR = [
  {min:0,   label:'Curieux',      icon:'🌫️'},
  {min:3,   label:'Flâneur',      icon:'🚶'},
  {min:8,   label:'Explorateur',  icon:'🧭'},
  {min:15,  label:'Vagabond',     icon:'🌙'},
  {min:30,  label:'Hanteur',      icon:'👻'},
  {min:60,  label:'Spectre',      icon:'🔮'},
  {min:100, label:'Légende',      icon:'⭐'},
];
const RANKS_EN = [
  {min:0,   label:'Curious',      icon:'🌫️'},
  {min:3,   label:'Wanderer',     icon:'🚶'},
  {min:8,   label:'Explorer',     icon:'🧭'},
  {min:15,  label:'Drifter',      icon:'🌙'},
  {min:30,  label:'Haunter',      icon:'👻'},
  {min:60,  label:'Spectre',      icon:'🔮'},
  {min:100, label:'Legend',       icon:'⭐'},
];
const RANKS = () => _currentLang === 'en' ? RANKS_EN : RANKS_FR;

function getRank(n) {
  const ranks = RANKS();
  let rank = ranks[0];
  let rankIdx = 0;
  for (let i = 0; i < ranks.length; i++) { if (n >= ranks[i].min) { rank = ranks[i]; rankIdx = i; } }
  return { ...rank, index: rankIdx };
}

// ══════════════════════════════════════════════════════════
// COLLECTION DE CARTES (Lot L)
// Progression combinée unique (L3, tranché — finalisation Lots K/L) : une
// seule piste de cartes plutôt que 4 pistes séparées par stat. Les stats déjà
// trackées (découvertes, dépôts, résonances, série de jours actifs) sont
// agrégées en un score unique — la série est pondérée ×3 car elle est
// rate-limitée à un jour par jour (donc plus rare/dure à accumuler que les
// autres actions, qui peuvent se répéter plusieurs fois par session) ;
// discoveries/dépôts/résonances comptent à égalité (même ordre de grandeur
// d'effort, une action = un point). Toujours entièrement dérivé à
// l'affichage, aucun nouveau champ Firestore, aucun état à persister (le
// score ne peut que croître).
const CARD_COMBINED_MILESTONES = [3, 8, 15, 25, 40, 60, 90, 130, 180, 250];
const CARD_TIER_NAMES_FR = ['Premier pas', 'Régulier', 'Habitué', 'Assidu', 'Confirmé', 'Endurant', 'Expert', 'Vétéran', 'Maître', 'Légende'];
const CARD_TIER_NAMES_EN = ['First step', 'Regular', 'Habitué', 'Dedicated', 'Confirmed', 'Enduring', 'Expert', 'Veteran', 'Master', 'Legend'];

function _combinedCollectionScore(stats) {
  return (stats.discovered || 0) + (stats.deposited || 0) + (stats.resonances || 0) + (stats.streak || 0) * 3;
}

function _renderTraceCollection(stats) {
  const grid = document.getElementById('traceCollectionGrid');
  const progressEl = document.getElementById('collectionProgress');
  if (!grid) return;
  const tierNames = _currentLang === 'en' ? CARD_TIER_NAMES_EN : CARD_TIER_NAMES_FR;
  const score = _combinedCollectionScore(stats);
  let unlockedCount = 0;
  const html = CARD_COMBINED_MILESTONES.map((threshold, i) => {
    const unlocked = score >= threshold;
    if (unlocked) unlockedCount++;
    const tier = tierNames[i] || threshold;
    return `<div class="trace-card ${unlocked ? 'unlocked' : 'locked'}" title="${escapeHTML(tier)} · ${threshold}">` +
      `<div class="trace-card-icon" aria-hidden="true">${unlocked ? '✦' : '🔒'}</div>` +
      `<div class="trace-card-count">${threshold}</div>` +
      `</div>`;
  }).join('');
  grid.innerHTML = html;
  if (progressEl) progressEl.textContent = unlockedCount + ' / ' + CARD_COMBINED_MILESTONES.length;
}

// ── Update rank bar in radar ──────────────────────────────
function updateRankBar() {
  const count = getDiscoveryCount();
  const ranks = RANKS();
  const { index } = getRank(count);
  const current = ranks[index];
  const next = ranks[index + 1] || null;
  const badge = document.getElementById('rankBadge');
  const fill = document.getElementById('rankProgressFill');
  const nextEl = document.getElementById('rankNext');
  if (!badge) return;
  badge.textContent = current.icon + ' ' + current.label;
  if (next) {
    const progress = ((count - current.min) / (next.min - current.min)) * 100;
    fill.style.width = Math.min(progress, 100) + '%';
    nextEl.textContent = '→ ' + next.label + ' (' + next.min + ')';
    nextEl.style.display = '';
  } else {
    fill.style.width = '100%';
    nextEl.textContent = '★ MAX';
    nextEl.style.display = '';
  }
}

// ── Ghost Tier System (rarity) ────────────────────────────
// Tier attribué au moment de l'affichage (basé sur un hash déterministe)
const GHOST_TIERS = [
  { name: 'common',    weight: 70, label: '' },
  { name: 'uncommon',  weight: 20, label: 'Écho' },
  { name: 'rare',      weight: 8,  label: 'Murmure' },
  { name: 'legendary', weight: 2,  label: 'Spectre' },
];
const GHOST_TIERS_EN = { uncommon: 'Echo', rare: 'Whisper', legendary: 'Specter' };

function getGhostTier(ghostId) {
  // Hash déterministe du ghostId pour un tier stable
  let hash = 0;
  for (let i = 0; i < ghostId.length; i++) {
    hash = ((hash << 5) - hash) + ghostId.charCodeAt(i);
    hash |= 0;
  }
  const roll = Math.abs(hash) % 100;
  if (roll < 2)  return GHOST_TIERS[3]; // legendary
  if (roll < 10) return GHOST_TIERS[2]; // rare
  if (roll < 30) return GHOST_TIERS[1]; // uncommon
  return GHOST_TIERS[0]; // common
}

function getTierLabel(tier) {
  if (tier.name === 'common') return '';
  if (_currentLang === 'en') return GHOST_TIERS_EN[tier.name] || tier.label;
  return tier.label;
}

function getTierBadgeHTML(tier) {
  if (tier.name === 'common') return '';
  return '<span class="tier-badge tier-badge-' + tier.name + '">' + getTierLabel(tier) + '</span>';
}

// ── Audio toggle ──────────────────────────────────────────
window.toggleAudioEnabled = () => {
  const btn = document.getElementById('audioToggleBtn');
  const key = 'ghostub_audio_enabled';
  const current = localStorage.getItem(key) !== '0';
  const next = !current;
  localStorage.setItem(key, next ? '1' : '0');
  AudioService.setEnabled(next);
  HapticsService.setEnabled(next);
  btn.textContent = next ? '🔊' : '🔇';
  btn.classList.toggle('muted', !next);
};
// Restore audio preference
(function() {
  const pref = localStorage.getItem('ghostub_audio_enabled');
  if (pref === '0') {
    AudioService.setEnabled(false);
    HapticsService.setEnabled(false);
    const btn = document.getElementById('audioToggleBtn');
    if (btn) { btn.textContent = '🔇'; btn.classList.add('muted'); }
  }
})();

// ── Accordéon "Condition d'ouverture" (Lot H3) ──────────────
// Replié par défaut, affiche juste le choix actuel — ne se déplie que pour
// changer. Remplace l'ancien système de nappe/bandeau d'outils (Lot H1).
const _CORD_ACCORDION_LABELS = {
  always: '✉ ',
  night:  '🌙 ',
  hour:   '⏰ ',
  future: '📅 ',
};
function _updateCondAccordionSummary() {
  const el = document.getElementById('condAccordionSummary');
  if (!el) return;
  const cond = getSelectedCond();
  const labelKey = { always: 'dep_cond_always_label', night: 'dep_cond_night_label', hour: 'dep_cond_hour_label', future: 'dep_cond_future_label' }[cond] || 'dep_cond_always_label';
  el.textContent = (_CORD_ACCORDION_LABELS[cond] || _CORD_ACCORDION_LABELS.always) + (t[labelKey] || 'Toujours accessible');
}
window.toggleCondAccordion = (forceOpen) => {
  const toggle = document.getElementById('condAccordionToggle');
  const content = document.getElementById('condAccordionContent');
  if (!toggle || !content) return;
  const open = typeof forceOpen === 'boolean' ? forceOpen : !toggle.classList.contains('open');
  toggle.classList.toggle('open', open);
  content.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
};
// Un choix de condition referme l'accordéon et met à jour le résumé —
// délégation sur le conteneur (pas de changement de selectCond() lui-même,
// qui reste la seule logique métier ici).
document.getElementById('condAccordionContent')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.cond-btn');
  if (!btn || !btn.classList.contains('active')) return;
  _updateCondAccordionSummary();
  window.toggleCondAccordion(false);
});

// ── Accordéons "Rayon", "Durée de vie", "Disparaît après" (Lot N) ──
// Même modèle que l'accordéon Condition d'ouverture ci-dessus : repliés par
// défaut, résumé icône + valeur active, se referment après un choix.
function _toggleDepositAccordion(toggleId, contentId, forceOpen) {
  const toggle = document.getElementById(toggleId);
  const content = document.getElementById(contentId);
  if (!toggle || !content) return;
  const open = typeof forceOpen === 'boolean' ? forceOpen : !toggle.classList.contains('open');
  toggle.classList.toggle('open', open);
  content.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
window.toggleRadiusAccordion  = (forceOpen) => _toggleDepositAccordion('radiusAccordionToggle', 'radiusAccordionContent', forceOpen);
window.toggleDurAccordion     = (forceOpen) => _toggleDepositAccordion('durAccordionToggle', 'durAccordionContent', forceOpen);
window.toggleMaxOpenAccordion = (forceOpen) => _toggleDepositAccordion('maxOpenAccordionToggle', 'maxOpenAccordionContent', forceOpen);

function _updateRadiusAccordionSummary() {
  const el = document.getElementById('radiusAccordionSummary');
  const btn = document.querySelector('#radiusAccordionContent .radius-btn.active');
  if (el && btn) el.textContent = '📡 ' + btn.textContent.trim();
}
function _updateDurAccordionSummary() {
  const el = document.getElementById('durAccordionSummary');
  const btn = document.querySelector('#durAccordionContent .dur-btn.active');
  if (el && btn) el.textContent = '⏳ ' + btn.textContent.trim();
}
function _updateMaxOpenAccordionSummary() {
  const el = document.getElementById('maxOpenAccordionSummary');
  const btn = document.querySelector('#maxOpenAccordionContent .dur-btn.active');
  if (el && btn) el.textContent = '👁️ ' + btn.textContent.trim();
}
document.getElementById('radiusAccordionContent')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.radius-btn');
  if (!btn || !btn.classList.contains('active')) return;
  _updateRadiusAccordionSummary();
  window.toggleRadiusAccordion(false);
});
document.getElementById('durAccordionContent')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.dur-btn');
  if (!btn || !btn.classList.contains('active')) return;
  _updateDurAccordionSummary();
  window.toggleDurAccordion(false);
});
document.getElementById('maxOpenAccordionContent')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.dur-btn');
  if (!btn || !btn.classList.contains('active')) return;
  _updateMaxOpenAccordionSummary();
  window.toggleMaxOpenAccordion(false);
});

// ── Accordéon "Type d'offre" (Lot O) ──
// Même modèle que ci-dessus — Identité a été retirée en tant que réglage
// visible au Lot Q (remplacée par le lien discret "rester anonyme").
window.toggleBizTypeAccordion    = (forceOpen) => _toggleDepositAccordion('bizTypeAccordionToggle', 'bizTypeAccordionContent', forceOpen);

function _updateBizTypeAccordionSummary() {
  const el = document.getElementById('bizTypeAccordionSummary');
  const btn = document.querySelector('#bizTypeAccordionContent .type-btn.active');
  if (el && btn) el.textContent = btn.textContent.trim();
}
document.getElementById('bizTypeAccordionContent')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.type-btn');
  if (!btn || !btn.classList.contains('active')) return;
  _updateBizTypeAccordionSummary();
  window.toggleBizTypeAccordion(false);
});

// ── Menu média compact (Lot Q) ──────────────────────────────
// Un bouton unique révèle un menu ; choisir une ligne révèle SEULEMENT le
// bloc média correspondant, à la place des 4 blocs empilés en permanence.
// La logique propre à chaque média (record/photo/vidéo/documents) n'est
// pas touchée — seule l'entrée change. L'aperçu qui remplace le bouton
// d'origine une fois un média ajouté est géré en CSS pur (:has()).
const MEDIA_PANEL_IDS = { vocal: 'step3VocalWrap', photo: 'step3PhotoWrap', video: 'step3VideoWrap', attach: 'step3AttachmentsWrap' };
window.toggleMediaMenu = (forceOpen) => _toggleDepositAccordion('mediaAddBtn', 'mediaMenuPanel', forceOpen);
window.selectMediaType = (type) => {
  const panel = document.getElementById(MEDIA_PANEL_IDS[type]);
  if (panel) panel.style.display = 'block';
  window.toggleMediaMenu(false);
};

// ── Lien discret "rester anonyme" (Lot Q) ──────────────────
// Remplace le dropdown Identité : pseudo par défaut, l'anonymat est un
// simple toggle texte, pas un réglage mis en avant.
window.toggleAnonMode = (btn) => {
  const active = btn.classList.toggle('active');
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  const label = btn.querySelector('span');
  if (label) label.textContent = active
    ? (t.dep_anon_toggle_on || '👻 anonyme')
    : (t.dep_anon_toggle_off || '🌫️ rester anonyme');
};
function _resetAnonToggle() {
  const btn = document.getElementById('anonToggleLink');
  if (!btn) return;
  btn.classList.remove('active');
  btn.setAttribute('aria-pressed', 'false');
  const label = btn.querySelector('span');
  if (label) label.textContent = t.dep_anon_toggle_off || '🌫️ rester anonyme';
}

// ── Proximity data attribute helper ────────────────────────
function getProximityClass(distM) {
  if (distM <= 15) return 'close';
  if (distM <= 30) return 'near';
  if (distM <= 50) return 'approaching';
  return '';
}

function showDiscoveryToast(count, isNew) {
  const toast = document.getElementById('discoveryToast');
  const icon  = document.getElementById('toastIcon');
  const text  = document.getElementById('toastText');
  if (!toast) return;
  toast.classList.remove('discovery-toast-rare', 'discovery-toast-secret');
  const rank = getRank(count);
  const isMilestone = MILESTONES.includes(count) && isNew;
  if (isNew) {
    const _su = _updateStreak();
    _renderStreak();
    updateRankBar();
    if (_su.freezeJustUsed) showToast('info', t.streak_freeze_used);
  }
  // Play chime on new discovery
  if (isNew) {
    AudioService.playChime();
    // Check if this ghost has a special tier
    if (selectedGhost) {
      const tier = getGhostTier(selectedGhost.id);
      if (tier.name === 'legendary') {
        setTimeout(() => AudioService.playRareGhost(), 800);
        HapticsService.rareGhost();
      } else if (tier.name === 'rare') {
        setTimeout(() => AudioService.playChime(1046), 600);
        HapticsService.milestone();
      }
    }
  }
  if (isMilestone) {
    icon.textContent = rank.icon;
    text.innerHTML = '<b>' + count + ' ' + (_currentLang === 'fr' ? 'fantômes' : 'ghosts') + '</b> ' + (_currentLang === 'fr' ? 'découverts' : 'discovered') + ' ! <span class="milestone-badge">' + escapeHTML(rank.label) + '</span>';
    Analytics.track('milestone', { count, rank: rank.label });
  } else if (isNew) {
    icon.innerHTML = _BRAND_MARK_HTML;
    let _discoveredHTML = (_currentLang === 'fr' ? t.detail_discovered_prefix || 'Fantôme découvert · <b>' + count + '</b> au total' : 'Ghost discovered · <b>' + count + '</b> total');
    // Lot G4 : mise en scène différenciée par rareté — halo + mention doré
    // (rare/légendaire) ou lavande (secret), distincts du toast bleu commun.
    // Vocabulaire "découverte" volontairement conservé plutôt que "Résonance"
    // (cf. flag envoyé à Pipo : "Résonance" désigne déjà, ailleurs dans
    // l'app, la réaction quotidienne ✦ Résonner sur un fantôme — un nouveau
    // sens du même mot aurait créé une confusion produit).
    let _tierName = null;
    if (selectedGhost?.secret) {
      toast.classList.add('discovery-toast-secret');
      _tierName = 'secret'; // identique FR/EN
    } else if (selectedGhost) {
      const tier = getGhostTier(selectedGhost.id);
      if (tier.name === 'rare' || tier.name === 'legendary') {
        toast.classList.add('discovery-toast-rare');
        _tierName = getTierLabel(tier);
      }
    }
    if (_tierName) {
      const _tierClass = selectedGhost?.secret ? 'discovery-toast-tier-secret' : 'discovery-toast-tier-rare';
      _discoveredHTML += ' <span class="discovery-toast-tier ' + _tierClass + '">· ' + escapeHTML(_tierName) + '</span>';
    }
    text.innerHTML = _discoveredHTML;
    Analytics.track('ghost_discovered', { total: count });
  } else { return; }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function animateStatNumber(id, newVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const old = parseInt(el.textContent) || 0;
  if (old === newVal) return;
  el.textContent = newVal;
  el.classList.remove('bump');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('bump')));
  setTimeout(() => el.classList.remove('bump'), 400);
}

async function refreshProfileStats() {
  if (!currentUser) return;
  const count = getDiscoveryCount();
  const rank  = getRank(count);
  animateStatNumber('statDiscovered', count);
  document.getElementById('statRank').textContent = rank.icon + ' ' + rank.label;
  updateFavoritesCount();
  const firstReaderCount = parseInt(localStorage.getItem('ghostub_first_reader') || '0');
  animateStatNumber('statFirstReader', firstReaderCount);
  let deposited = 0, resonances = 0;
  try {
    // 1 lecture Firestore sur users/{uid} pour les compteurs dénormalisés
    const userSnap = await getDoc(doc(db, COLL.USERS, currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const _depKey2 = 'ghostub_total_deposited_' + currentUser.uid;
    const _localDep = parseInt(localStorage.getItem(_depKey2) || '0');
    if (userData.ghostCount != null) {
      deposited = Math.max(userData.ghostCount, _localDep);
    } else {
      // Fallback : compter les docs (migration douce)
      const snap = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid','==', currentUser.uid), limit(100)));
      deposited = Math.max(snap.size, _localDep);
    }
    animateStatNumber('statDeposited', deposited);
    if (userData.totalResonances != null) {
      resonances = userData.totalResonances;
    } else {
      const snap2 = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid','==', currentUser.uid), limit(100)));
      snap2.forEach(d => { resonances += d.data().resonances || 0; });
    }
    animateStatNumber('statResonances', resonances);
  } catch(e) { console.warn('refreshProfileStats:', e); }
  updateRankBar();
  // Collection de cartes (Lot L) — dérivée des stats déjà chargées ci-dessus,
  // aucune lecture Firestore supplémentaire.
  if (typeof _renderTraceCollection === 'function') {
    _renderTraceCollection({ discovered: count, deposited, resonances, streak: _getStreak().count });
  }
}
async function loadBizDashboard() {
  if (!currentUser) return;
  const section  = document.getElementById('bizDashboardSection');
  const content  = document.getElementById('bizDashboardContent');
  if (!section || !content) return;

  let snap;
  try {
    snap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      limit(50)
    ));
  } catch(e) {
    console.warn('[BizDashboard] erreur Firestore:', e);
    return;
  }

  // Filtrer côté client les fantômes commerce
  const bizDocs = snap.docs.filter(d => d.data().businessMode === true);
  if (bizDocs.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  // Lire ghostStats pour avoir les openCount à jour (fallback si règles bloquent l'update direct)
  const statsMap = {};
  try {
    const statsSnap = await getDocs(query(
      collection(db, COLL.GHOST_STATS),
      where('authorUid', '==', currentUser.uid)
    ));
    statsSnap.forEach(d => { statsMap[d.id] = d.data().openCount || 0; });
  } catch(e) { console.warn('[ghostub:loadBizDashboard:ghostStats]', e); }

  let html = '';
  bizDocs.forEach(d => {
    const g   = d.data();
    const id  = d.id;
    const opens = Math.max(g.openCount || 0, statsMap[id] || 0);
    const expired = isExpired(g);
    const location = escapeHTML(g.location || t.detail_location_unknown);
    const title = g.message ? escapeHTML(g.message.split('\n')[0].replace(/^🏪 [^:]+: /, '')) : location;

    // Calcul expiration
    let expiryHtml = '';
    if (!expired && g.createdAt) {
      const msCreated = g.createdAt.seconds * 1000;
      const msExpiry  = msCreated + 30 * 24 * 3600 * 1000; // 1 mois
      const daysLeft  = Math.ceil((msExpiry - Date.now()) / 86400000);
      if (daysLeft <= 7 && daysLeft > 0) {
        expiryHtml = `<span class="biz-expiry-soon">⏰ ${_currentLang === 'fr' ? 'Expire dans' : 'Expires in'} ${daysLeft}${_currentLang === 'fr' ? 'j' : 'd'}</span>`;
      } else if (daysLeft <= 0) {
        expiryHtml = `<span class="biz-expiry-expired">⏳ ${_currentLang === 'fr' ? 'Expirée' : 'Expired'}</span>`;
      } else {
        expiryHtml = `<span class="biz-expiry-normal">⏳ ${daysLeft}${_currentLang === 'fr' ? 'j restants' : 'd left'}</span>`;
      }
    }

    // Badge ouvertures
    const opensClass = opens >= 10 ? 'biz-opens-high' : opens >= 3 ? 'biz-opens-mid' : 'biz-opens-low';

    html += `
      <div class="biz-card">
        <div class="biz-card-row">
          <span class="biz-card-emoji">🏪</span>
          <div class="biz-card-info">
            <div class="biz-card-title">${title}</div>
            <div class="biz-card-location">${location}</div>
            <div class="biz-card-meta">
              <span class="biz-opens ${opensClass}">👁 ${opens} ${_currentLang === 'fr' ? 'ouverture' + (opens > 1 ? 's' : '') : 'open' + (opens > 1 ? 's' : '')}</span>
              ${expiryHtml}
              ${expired ? (_currentLang === 'fr' ? '<span class="biz-expired-badge">Expirée</span>' : '<span class="biz-expired-badge">Expired</span>') : ''}
            </div>
          </div>
        </div>
        ${!expired ? `<button data-action="renewBusinessGhost" data-id="${escapeHTML(id)}" class="biz-renew-btn">${_currentLang === 'fr' ? '↻ Renouveler pour 1 mois' : '↻ Renew for 1 month'}</button>` : ''}
      </div>`;
  });
  content.innerHTML = html || `<div class="biz-empty">${_currentLang === 'fr' ? 'Aucune offre commerce active' : 'No active commerce offers'}</div>`;
}

window.renewBusinessGhost = async (ghostId) => {
  if (!currentUser || !isPremium) return;
  const confirmed = await showConfirm('Renouveler l\'offre ?', 'La durée de vie de cette offre sera remise à 1 mois à partir d\'aujourd\'hui.', { confirmLabel: '↻ Renouveler' });
  if (!confirmed) return;
  try {
    await updateDoc(doc(db, COLL.GHOSTS, ghostId), {
      createdAt: serverTimestamp(),
      expired: false
    });
    showToast('success', t.toast_renew_ok);
    loadBizDashboard();
  } catch(e) {
    showToast('warning', t.toast_renew_err);
  }
};

// ── LE CARNET — lecture complète + résumé des réactions (juin 2026) ────
// Étend les listes existantes (déposés / découverts) avec une vraie lecture
// du texte intégral, et — pour tes propres fantômes — un résumé des réactions
// reçues (chargé à la demande, pas en masse, pour ne pas multiplier les lectures Firestore).
const _carnetReactionsCache = {};
window.toggleCarnetEntry = async (id, withReactions, btn) => {
  const el = document.getElementById('carnet-' + id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.textContent = isOpen ? t.carnet_read_btn : t.carnet_close_btn;
  if (isOpen) return;
  if (!withReactions) return;
  const reactEl = document.getElementById('carnet-reactions-' + id);
  if (!reactEl) return;
  if (_carnetReactionsCache[id]) { reactEl.innerHTML = _carnetReactionsCache[id]; return; }
  reactEl.innerHTML = `<span class="carnet-reaction-loading">${t.loading || 'Chargement…'}</span>`;
  try {
    const snap = await getDocs(query(collection(db, COLL.REPLIES), where('ghostId', '==', id)));
    const counts = {};
    snap.forEach(d => {
      const txt = (d.data().message || '').trim();
      if (txt) counts[txt] = (counts[txt] || 0) + 1;
    });
    const entries = Object.entries(counts);
    const html = entries.length
      ? entries.map(([txt, n]) => `<span class="carnet-reaction-pill">✦ ${escapeHTML(txt)}${n > 1 ? ' ×' + n : ''}</span>`).join('')
      : `<span class="carnet-reaction-loading">${t.carnet_no_reactions}</span>`;
    _carnetReactionsCache[id] = html;
    reactEl.innerHTML = html;
  } catch(e) {
    console.warn('[ghostub:toggleCarnetEntry]', e);
    reactEl.innerHTML = '';
  }
};

window.toggleDiscoveryHistory = async () => {
  const panel = document.getElementById('discoveryHistory');
  const list = document.getElementById('discoveryHistoryList');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  // Fermer l'autre panel si ouvert
  document.getElementById('depositedList').style.display = 'none';
  panel.style.display = 'block';
  const ids = getDiscoveredIds();
  if (ids.length === 0) { list.innerHTML = `<div class="carnet-empty">${t.profile_no_discoveries || 'Aucune découverte encore…'}</div>`; return; }
  list.innerHTML = `<div class="carnet-loading">${t.loading || 'Chargement…'}</div>`;
  try {
    const results = [];
    for (const id of ids.slice(-20).reverse()) { // 20 dernières
      try {
        const d = await getDoc(doc(db, COLL.GHOSTS, id));
        if (d.exists()) {
          const g = d.data();
          results.push(`<div class="discovery-item">
            <div class="discovery-item-row">
              <span class="discovery-item-emoji">${_ghostEmojiHTML(g)}</span>
              <div class="discovery-item-info">
                <div class="discovery-item-location">${escapeHTML(g.location||t.detail_location_unknown)}</div>
                <div class="discovery-item-date">${g.createdAt ? new Date(g.createdAt.seconds*1000).toLocaleDateString(_currentLang === 'fr' ? 'fr-FR' : 'en-GB') : ''}</div>
              </div>
              <button class="carnet-toggle" data-action="toggleCarnetEntry" data-id="${escapeHTML(id)}" data-reactions="false">${t.carnet_read_btn}</button>
            </div>
            <div class="carnet-reading u-hidden" id="carnet-${escapeHTML(id)}">${escapeHTML(g.message || '')}</div>
          </div>`);
        }
      } catch(e) { console.warn('[ghostub:toggleDiscoveryHistory]', e); }
    }
    list.innerHTML = results.length ? results.join('') : '<div class="carnet-empty">Données indisponibles</div>';
  } catch(e) { list.innerHTML = '<div class="carnet-loading">Erreur de chargement</div>'; }
};

// ── MES FANTÔMES DÉPOSÉS ────────────────────────────────
window.toggleDepositedList = async () => {
  const panel = document.getElementById('depositedList');
  const content = document.getElementById('depositedListContent');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  // Fermer l'autre panel si ouvert
  document.getElementById('discoveryHistory').style.display = 'none';
  panel.style.display = 'block';
  if (!currentUser) return;
  content.innerHTML = `<div class="carnet-loading">${t.loading || 'Chargement…'}</div>`;
  try {
    const snap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    ));
    if (snap.empty) {
      content.innerHTML = `<div class="carnet-empty">${t.profile_no_deposits || t.profile_no_ghost_deposited || 'Aucun fantôme déposé encore…'}</div>`;
      return;
    }
    let html = '';
    snap.forEach(d => {
      const g = d.data();
      const id = d.id;
      const date = g.createdAt ? new Date(g.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '—';
      const resonances = g.resonances || 0;
      const expired = isExpired(g);
      html += `
        <div id="deposited-item-${escapeHTML(id)}" class="deposited-item">
          <div class="deposited-item-row">
            <span class="deposited-item-emoji">${_ghostEmojiHTML(g)}</span>
            <div class="deposited-item-info">
              <div class="deposited-item-location">${escapeHTML(g.location||t.detail_location_unknown)}</div>
              <div class="deposited-item-meta">
                <span>${date}</span>
                <span>✦ ${resonances} résonance${resonances > 1 ? 's' : ''}</span>
                <span>👁 ${g.openCount || 0} ${_currentLang === 'fr' ? 'ouverture' + ((g.openCount || 0) > 1 ? 's' : '') : 'open' + ((g.openCount || 0) > 1 ? 's' : '')}</span>
                ${expired ? '<span class="deposited-meta-expired">⏳ Expiré</span>' : ''}
                ${g.secret ? '<span class="deposited-meta-secret">🔮 Secret</span>' : ''}
              </div>
            </div>
            <button data-action="deleteOneGhost" data-id="${escapeHTML(id)}" aria-label="Supprimer ce fantôme" class="deposited-delete-btn">🗑</button>
          </div>
          <div class="deposited-carnet-row">
            <button class="carnet-toggle" data-action="toggleCarnetEntry" data-id="${escapeHTML(id)}" data-reactions="true">${t.carnet_read_btn}</button>
          </div>
          <div class="carnet-reading u-hidden" id="carnet-${escapeHTML(id)}">
            ${escapeHTML(g.message || '')}
            <div class="carnet-reactions" id="carnet-reactions-${escapeHTML(id)}"></div>
          </div>
        </div>`;
    });
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div class="carnet-loading">Erreur de chargement</div>';
  }
};

window.deleteOneGhost = async (ghostId) => {
  const confirmed = await showConfirm(t.confirm_delete_ghost_title, t.confirm_delete_ghost_sub);
  if (!confirmed) return;
  try {
    // Supprimer les réponses associées
    const replies = await getDocs(query(collection(db, COLL.REPLIES), where('ghostId', '==', ghostId)));
    const dels = replies.docs.map(d => deleteDoc(doc(db, COLL.REPLIES, d.id)));
    await Promise.all([...dels, deleteDoc(doc(db, COLL.GHOSTS, ghostId))]);
    // Retirer l'élément de la liste sans recharger
    const item = document.getElementById('deposited-item-' + ghostId);
    if (item) {
      item.style.transition = 'opacity .3s, max-height .3s';
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 300);
    }
    // Mettre à jour le compteur
    const statEl = document.getElementById('statDeposited');
    if (statEl) statEl.textContent = Math.max(0, parseInt(statEl.textContent || '0') - 1);
    // Retirer du radar si présent
    nearbyGhosts = nearbyGhosts.filter(g => g.id !== ghostId);
    renderGhostList();
    showToast('success', t.toast_delete_ghost);
    Analytics.track('delete_one_ghost');
  } catch(e) {
    showToast('error', t.toast_delete_err);
  }
};

function updatePremiumUI() {
  const planEl = document.getElementById('planInfo');
  const codeSection = document.getElementById('codeSection');
  if (!planEl) return;
  // Lock/unlock sections Premium
  const dedLock = document.getElementById('dedicatedLock');
  if (dedLock) dedLock.style.display = isPremium ? 'none' : 'flex';
  // Sections Premium — injection directe dans les wrappers
  const _premSections = [
    { id: 'premSection_video',     icon: '🎥', label: t.prem_video_label || 'Vidéo', sub: t.prem_video_sub || 'Jusqu\'à 20 sec · s\'ouvre uniquement sur place',
      premiumHtml: `<label class="form-label prem-label-row"><span>${t.prem_video_optional || 'Vidéo (optionnel)'}</span><span class="prem-badge-inline">✦ Premium</span></label><button class="media-btn" data-action="triggerVideo" type="button"><span class="media-icon">🎥</span><span>${t.dep_video_btn || 'Ajouter une vidéo'}</span><span class="prem-btn-hint">max 50 Mo · 20 sec</span></button>` },
    { id: 'premSection_chain',     icon: '🔗', label: t.prem_chain_label || 'Chaîne de fantômes', sub: t.prem_chain_sub || 'Chasse au trésor urbaine · enchaîne tes ghosts',
      premiumHtml: null }, // chainContent géré séparément
    { id: 'premSection_dedicated', icon: '💌', label: t.prem_dedicated_label || 'Pour quelqu\'un', sub: t.prem_dedicated_sub || 'Ghost secret réservé à une seule personne',
      premiumHtml: null }, // dedicatedContent géré séparément
    // Phase 1d v103 — Galerie de fichiers
    { id: 'premSection_attachments', icon: '📎', label: t.prem_attach_label || 'Documents', sub: t.prem_attach_sub || 'PDF, JPG, PNG · jusqu\'à 3 fichiers',
      premiumHtml: `<label class="form-label prem-label-row"><span>${t.dep_attach_label || '📎 Documents (optionnel)'}</span><span class="prem-badge-inline">✦ Premium</span></label><button class="media-btn" data-action="triggerAttachments" type="button"><span class="media-icon">📎</span><span>${t.dep_attach_btn || 'Ajouter un fichier'}</span><span class="prem-btn-hint">PDF, JPG, PNG</span></button>` },
  ];

  const _badge = (txt) => `<span class="badge-premium">✦ Premium</span>`;
  const _freeBtn = (icon, label, sub) => `<button class="cond-btn free-btn-full" data-action="nav" data-screen="screenProfile" data-nav="nav-profile" type="button"><span class="cond-btn-icon">${icon}</span><span class="cond-btn-text"><div class="cond-btn-label">${label} ${_badge()}</div><div class="cond-btn-sub">${sub}</div></span></button>`;

  _premSections.forEach(({ id, icon, label, sub, premiumHtml }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = isPremium
      ? (premiumHtml || '')
      : _freeBtn(icon, label, sub);
  });
  // Badges Premium du menu média compact (Lot Q)
  ['mediaMenuVideoBadge', 'mediaMenuAttachBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isPremium ? 'none' : '';
  });
  // Verrous du sélecteur de teinte du Trace (Lot K)
  if (typeof _renderTraceColorPicker === 'function') _renderTraceColorPicker();

  // Afficher/masquer chainContent et dedicatedContent
  const chainContent = document.getElementById('chainContent');
  if (chainContent) chainContent.style.display = isPremium ? 'flex' : 'none';
  const dedContent = document.getElementById('dedicatedContent');
  if (dedContent) dedContent.style.display = isPremium ? 'block' : 'none';
  // Phase 1d : afficher/masquer le conteneur des fichiers joints + render la liste
  const attachContent = document.getElementById('attachmentsContent');
  if (attachContent) attachContent.style.display = isPremium ? 'block' : 'none';
  if (typeof _renderAttachmentsList === 'function') _renderAttachmentsList();
  // Verrou 5/10 lectures (A2-bis) — gratuit reste forcé à 1
  if (typeof _updateMaxOpenLockUI === 'function') _updateMaxOpenLockUI();
  // Badge avatar Premium
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    avatar.style.border = isPremium
      ? '1.5px solid rgba(var(--premium-rgb),.6)'
      : '1px solid var(--border-bright)';
    avatar.style.boxShadow = isPremium ? '0 0 14px rgba(var(--premium-rgb),.2)' : '';
    // Badge ✦ Premium sous l'avatar
    const existingBadge = document.getElementById('premiumAvatarBadge');
    if (isPremium && !existingBadge) {
      const badge = document.createElement('div');
      badge.id = 'premiumAvatarBadge';
      badge.textContent = '✦ Premium';
      badge.style.cssText = 'font-size:10px;color:rgba(var(--premium-rgb),.85);background:rgba(var(--premium-rgb),.1);border:1px solid rgba(var(--premium-rgb),.3);border-radius:20px;padding:2px 10px;margin-top:4px;letter-spacing:.5px;display:inline-block;';
      avatar.parentNode.insertBefore(badge, avatar.nextSibling);
    } else if (!isPremium && existingBadge) {
      existingBadge.remove();
    }
  }
  const pricingSection = document.getElementById('pricingSection');
  if (isPremium) {
    planEl.style.display = 'block';
    planEl.innerHTML = '<div class="profile-panel-label-premium">✦ ' + t.profile_premium_plan + '</div><div class="profile-panel-content">' + t.profile_premium_sub + '</div>';
    if (codeSection) codeSection.style.display = 'none';
    if (pricingSection) pricingSection.style.display = 'none';
  } else {
    planEl.style.display = 'none';
    if (codeSection) codeSection.style.display = 'block';
    if (pricingSection) pricingSection.style.display = 'block';
  }

  // ── Badge ✦ Premium dans le header radar ────────────────
  const radarTitle = document.querySelector('#screenRadar .radar-title');
  const existingRadarBadge = document.getElementById('radarPremiumBadge');
  if (isPremium && radarTitle && !existingRadarBadge) {
    const rb = document.createElement('span');
    rb.id = 'radarPremiumBadge';
    rb.textContent = '✦';
    rb.setAttribute('aria-label', 'Compte Premium');
    rb.style.cssText = 'margin-left:7px;font-size:13px;color:rgba(var(--premium-rgb),.85);' +
      'animation:ghostFloat 2.8s ease-in-out infinite;display:inline-block;' +
      '-webkit-text-fill-color:rgba(var(--premium-rgb),.85)!important;vertical-align:middle;';
    radarTitle.appendChild(rb);
  } else if (!isPremium && existingRadarBadge) {
    existingRadarBadge.remove();
  }
}



// ── VÉRIFICATION PREMIUM SERVEUR ─────────────────────────
// Relit Firestore avant toute opération Premium critique
// Empêche le contournement via DevTools
async function _verifyPremiumServer() {
  if (!currentUser) return false;
  try {
    const snap = await getDoc(doc(db, COLL.USERS, currentUser.uid));
    const serverPremium = snap.exists() && snap.data().premium === true;
    if (serverPremium !== isPremium) {
      isPremium = serverPremium; // sync si désynchronisé
      updatePremiumUI();
    }
    return serverPremium;
  } catch(e) {
    console.warn('_verifyPremiumServer:', e);
    return isPremium; // fallback sur valeur locale si réseau indispo
  }
}


// ── PRICING CARDS BILINGUES ──────────────────────────────
function _renderPricingCards() {
  const section = document.getElementById('pricingSection');
  if (!section || isPremium) return;
  const isEn = _currentLang === 'en';
  section.innerHTML = `
    <!-- Premium — bordure légèrement lumineuse bleu spirit (Lot J2) -->
    <div class="plan-card plan-card-premium">
      <div class="plan-card-header">
        <div>
          <div class="plan-card-label plan-card-label-premium">✦ ${isEn ? 'Premium Hunter' : 'Chasseur Premium'}</div>
          <div class="plan-card-price">0,99€ <span class="plan-card-price-period">${isEn ? '/month' : '/mois'}</span></div>
        </div>
        <div class="plan-card-icon-wrap">${_BRAND_MARK_HTML}</div>
      </div>
      <div class="plan-card-features">
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Unlimited openings' : 'Ouvertures illimitées'}</div>
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Instant drop' : 'Dépôt immédiat'}</div>
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Video + audio 🎥' : 'Vidéo + vocal 🎥'}</div>
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Dedicated ghost 💌' : 'Ghost dédié 💌'}</div>
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Ghost chain 🔗' : 'Chaîne fantômes 🔗'}</div>
        <div class="plan-feature-row"><span class="plan-check-blue">✓</span> ${isEn ? 'Future message 📅' : 'Message futur 📅'}</div>
      </div>
      <button id="stripeBtn" data-action="startStripeCheckout" data-arg="premium" class="plan-card-cta plan-card-cta-premium plan-card-cta--stub">${t.stripe_btn_premium || '✦ Become Premium Hunter'}<span class="plan-cta-soon-badge">🔜 ${isEn ? 'Soon' : 'Bientôt'}</span></button>
    </div>
    <!-- Commerce — bordure légèrement lumineuse dorée (Lot J2) -->
    <div class="plan-card plan-card-commerce">
      <div class="plan-card-header">
        <div>
          <div class="plan-card-label plan-card-label-commerce">🏪 ${isEn ? 'Commerce Plan' : 'Plan Commerce'}</div>
          <div class="plan-card-price">4,99€ <span class="plan-card-price-period">${isEn ? '/month' : '/mois'}</span></div>
        </div>
        <div class="plan-card-icon-wrap-gold">🏪</div>
      </div>
      <div class="plan-card-features">
        <div class="plan-feature-row"><span class="plan-check-gold">✓</span> ${isEn ? 'All Premium included' : 'Tout Premium inclus'}</div>
        <div class="plan-feature-row"><span class="plan-check-gold">✓</span> ${isEn ? 'Commerce ghosts' : 'Ghosts Commerce'}</div>
        <div class="plan-feature-row"><span class="plan-check-gold">✓</span> ${isEn ? 'Promo code built-in' : 'Code promo intégré'}</div>
        <div class="plan-feature-row"><span class="plan-check-gold">✓</span> ${isEn ? 'Openings dashboard' : 'Dashboard ouvertures'}</div>
      </div>
      <button id="stripeBtnCommerce" data-action="startStripeCheckout" data-arg="commerce" class="plan-card-cta plan-card-cta-commerce plan-card-cta--stub">${t.stripe_btn_commerce || '🏪 Activate Commerce Plan'}<span class="plan-cta-soon-badge">🔜 ${isEn ? 'Soon' : 'Bientôt'}</span></button>
    </div>
    <!-- Code promo discret -->
    <div id="codeSection" class="profile-code-section">
      <details class="profile-code-details">
        <summary class="profile-code-summary">${isEn ? 'Have an activation code?' : 'Vous avez un code d\'activation ?'}</summary>
        <div class="profile-code-row">
          <input id="premiumCode" class="form-input profile-code-input" type="text" placeholder="CODE-XXXX" aria-label="Code Premium">
          <button id="activateBtn" data-action="activatePremium" class="profile-code-activate-btn">${t.profile_activate_btn || 'Activer'}</button>
        </div>
        <div id="premiumError" class="profile-code-error" role="alert" aria-live="polite"></div>
      </details>
    </div>
  `;
}

// ── STRIPE CHECKOUT ──────────────────────────────────────
// Stub — à connecter à la Cloud Function createCheckoutSession quand Stripe est prêt
window.startStripeCheckout = async (plan) => {
  const btn = plan === 'premium'
    ? document.getElementById('stripeBtn')
    : document.getElementById('stripeBtnCommerce');
  if (btn) { btn.textContent = '⏳' + (t.auth_loading || ' Connexion…'); btn.disabled = true; }
  try {
    // Appel à la Cloud Function (décommenter quand Stripe est configuré)
    // const fn = httpsCallable(functions, 'createCheckoutSession');
    // const { data } = await fn({ plan, uid: currentUser.uid, email: currentUser.email });
    // window.location.href = data.url; // Redirect vers Stripe Checkout
    // ─────────────────────────────────────────────────────
    // Temporaire : afficher un message d'attente
    showToast('info', plan === 'premium'
      ? (t.stripe_pending_premium || 'Paiement en ligne bientôt disponible.')
      : (t.stripe_pending_commerce || 'Paiement Commerce bientôt disponible.'));
    Analytics.track('stripe_intent', { plan });
  } catch(e) {
    showToast('error', t.misc_error_generic || 'Erreur — réessaie plus tard.');
    console.warn('startStripeCheckout:', e);
  } finally {
    if (btn) {
      btn.textContent = plan === 'premium'
        ? (t.stripe_btn_premium || '✦ Devenir Chasseur Premium')
        : (t.stripe_btn_commerce || '🏪 Activer le Plan Commerce');
      btn.disabled = false;
    }
  }
};

window.activatePremium = async () => {
  const input = document.getElementById('premiumCode');
  const code = input.value.trim().toUpperCase();
  const errEl = document.getElementById('premiumError');
  if (!code) { errEl.textContent = t.profile_code_empty; return; }
  if (code.length < 4) { errEl.textContent = t.profile_code_short; return; }
  errEl.textContent = '';
  const btn = document.getElementById('activateBtn');
  btn.textContent = t.profile_activating;
  btn.disabled = true;
  try {
    // La lecture de premiumCodes et l'écriture de users.premium sont bloquées
    // pour le client par firestore.rules — l'activation passe donc par la
    // Cloud Function admin SDK (transaction atomique côté serveur, anti
    // double-activation d'un même code).
    await _activatePremiumSecureCallable({ code });
    isPremium = true;
    updatePremiumUI();
    input.value = '';
    btn.textContent = t.profile_activated;
    showToast('success', t.profile_premium_toast, 4000);
    Analytics.track('premium_activated');
  } catch(e) {
    console.error('activatePremium error:', e);
    if (e.code === 'functions/not-found') errEl.textContent = t.profile_code_invalid;
    else if (e.code === 'functions/already-exists') errEl.textContent = t.profile_code_used;
    else errEl.textContent = t.profile_code_error_generic;
    btn.textContent = t.profile_activate_btn;
    btn.disabled = false;
  }
};

// ── SIGNALEMENT ─────────────────────────────────────────
const REPORT_THRESHOLD = 3;

function openReportModal() {
  if (_isGuestUser()) { _promptSignUp('guest_signup_generic'); return; }
  if (!currentUser) return;
  if (!selectedGhost) return;
  const key = 'reported_' + currentUser.uid + '_' + selectedGhost.id;
  if (localStorage.getItem(key)) {
    showReportFeedback(t.report_already);
    return;
  }
  if (selectedGhost.authorUid === currentUser.uid) {
    showReportFeedback(t.report_own);
    return;
  }
  openModal('reportModal', 'reportBtn');
}
window.openReportModal = openReportModal;

window.closeReportModal = (e) => {
  if (e && e.target !== document.getElementById('reportModal')) return;
  closeModal('reportModal');
};

window.submitReport = async (reason) => {
  if (_isGuestUser()) { _promptSignUp('guest_signup_generic'); return; }
  if (!currentUser || !selectedGhost) return;
  closeModal('reportModal');
  const ghostId = selectedGhost.id;
  const reporterUid = currentUser.uid;
  const key = 'reported_' + reporterUid + '_' + ghostId;
  try {
    await addDoc(collection(db, COLL.REPORTS), {
      ghostId,
      ghostLocation: selectedGhost.location || '',
      ghostAuthorUid: selectedGhost.authorUid || '',
      reporterUid,
      reason,
      createdAt: serverTimestamp()
    });
    localStorage.setItem(key, '1');
    showToast('success', t.toast_report_sent);
    // reportCount incrémenté pour la modération SERVEUR (Cloud Function autoModerateGhost).
    // La suppression au seuil de signalements est gérée côté serveur, PAS côté client :
    // les Firestore Rules interdisent à un non-auteur de lire /reports (read:false)
    // ou de supprimer le ghost d'autrui (delete réservé à l'auteur).
    // L'ancien bloc getDocs(reports)+deleteDoc levait donc une erreur visible alors
    // que le signalement avait bien été enregistré.
    await updateDoc(doc(db, COLL.GHOSTS, ghostId), { reportCount: increment(1) }).catch(() => {});
    const btn = document.getElementById('reportBtn');
    if (btn) { btn.classList.add('reported'); btn.innerHTML = '✓ Signalement envoyé'; }
    showReportFeedback(t.toast_report_saved);
    Analytics.track('ghost_reported', { reason });
  } catch(e) {
    showReportFeedback(t.toast_report_err);
  }
};

// ── TOAST SYSTEM ────────────────────────────────────────
// Autorise uniquement <b>, </b>, <br> dans les messages toast
function sanitizeToastMsg(msg) {
  if (!msg) return '';
  return String(msg)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
    .replace(/&lt;br\s*\/?&gt;/g, '<br>');
}

let _toastTimer = null;
function showToast(type, msg, duration = 3200) {
  const toast = document.getElementById('discoveryToast');
  const icon  = document.getElementById('toastIcon');
  const text  = document.getElementById('toastText');
  if (!toast) return;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: _BRAND_MARK_HTML, report: '⚑', link: '🔗' };
  if (!toast || !icon || !text) return;
  icon.innerHTML = icons[type] || _BRAND_MARK_HTML;
  text.innerHTML = sanitizeToastMsg(msg);
  toast.style.borderColor = 'rgba(var(--ghost-blue-rgb),.25)';
  if (type === 'success') toast.style.borderColor = 'rgba(var(--accent-green-rgb),.3)';
  if (type === 'error') toast.style.borderColor = 'rgba(255,100,100,.3)';
  if (type === 'warning') toast.style.borderColor = 'rgba(255,180,50,.3)';
  clearTimeout(_toastTimer);
  toast.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.classList.add('show');
    _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }));
}

function showReportFeedback(msg) {
  showToast('report', msg);
}

function updateReportBtn(ghostId) {
  const btn = document.getElementById('reportBtn');
  if (!btn || !currentUser) return;
  const key = 'reported_' + currentUser.uid + '_' + ghostId;
  const isOwn = selectedGhost && selectedGhost.authorUid === currentUser.uid;
  if (isOwn) {
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
    if (localStorage.getItem(key)) {
      btn.classList.add('reported');
      btn.innerHTML = t.detail_reported;
    } else {
      btn.classList.remove('reported');
      btn.innerHTML = t.detail_report_btn;
    }
  }
}

// ── PARTAGE ──────────────────────────────────────────────

// ── PARTAGE LIEU CARTE ───────────────────────────────────
window.shareMapLocation = async () => {
  const btn = document.getElementById('mapShareBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const count = nearbyGhosts.length;
    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Canvas 2D n'interprète pas var(--...) (contrairement au DOM/CSSOM) :
    // résoudre la valeur réelle à chaque génération pour rester correct si le thème change.
    const ghostBlueRgb = getComputedStyle(document.documentElement).getPropertyValue('--ghost-blue-rgb').trim();

    // Fond
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#06040e');
    bg.addColorStop(1, '#0a0816');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Étoiles
    for (let i = 0; i < 120; i++) {
      const sx = (Math.sin(i * 7.3) * 0.5 + 0.5) * W;
      const sy = (Math.sin(i * 13.7) * 0.5 + 0.5) * H;
      const sr = (Math.sin(i * 3.1) * 0.5 + 0.5) * 1.5 + 0.2;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${0.15 + (Math.sin(i*5.9)*0.5+0.5)*0.4})`; ctx.fill();
    }

    // Halo
    const halo = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 380);
    halo.addColorStop(0, 'rgba(120,80,255,0.22)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

    // Lignes déco
    ctx.strokeStyle = `rgba(${ghostBlueRgb},0.12)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 130); ctx.lineTo(W-80, 130); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, H-130); ctx.lineTo(W-80, H-130); ctx.stroke();

    // App name
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${ghostBlueRgb},0.45)`;
    ctx.font = '500 36px "Instrument Sans", sans-serif';
    ctx.fillText('GHOSTUB', W/2, 100);

    // Compteur central
    ctx.fillStyle = 'rgba(230,225,255,0.95)';
    ctx.font = `bold ${count >= 10 ? 140 : 160}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(String(count), W/2, H/2 - 20);

    // Label sous le chiffre
    ctx.fillStyle = `rgba(${ghostBlueRgb},0.7)`;
    ctx.font = 'italic 52px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? (count > 1 ? 'presences detected' : 'presence detected') : (count > 1 ? 'présences détectées' : 'présence détectée'), W/2, H/2 + 60);

    // Lieu (GPS)
    if (userLat && userLng) {
      ctx.fillStyle = 'rgba(255,240,200,0.6)';
      ctx.font = '38px "Instrument Sans", sans-serif';
      ctx.fillText(`${userLat.toFixed(3)}° N  ${userLng.toFixed(3)}° E`, W/2, H/2 + 140);
    }

    // CTA
    ctx.fillStyle = `rgba(${ghostBlueRgb},0.4)`;
    ctx.font = '34px "Instrument Sans", sans-serif';
    ctx.fillText(_currentLang === 'en' ? 'Come closer to discover what awaits you' : 'Approche-toi pour découvrir ce qui t’attend', W/2, H - 170);
    ctx.fillStyle = `rgba(${ghostBlueRgb},0.2)`;
    ctx.font = '28px "Instrument Sans", sans-serif';
    ctx.fillText('ghostub.app', W/2, H - 110);

    // Export
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'ghostub-lieu.png', { type: 'image/png' });
      const shareText = _currentLang === 'en'
        ? `${count} presence${count > 1 ? 's' : ''} detected here — come closer to discover what awaits you. 👻`
        : `${count} présence${count > 1 ? 's' : ''} détectée${count > 1 ? 's' : ''} ici — approche-toi pour découvrir ce qui t’attend. 👻`;
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '👻 Ghostub', text: shareText });
          Analytics.track('map_shared', { ghost_count: count });
        } catch(e) {
          if (e.name !== 'AbortError') _downloadCanvas(canvas, 'ghostub-lieu.png');
        }
      } else if (navigator.share) {
        try {
          const _refParam = currentUser ? '?ref=' + currentUser.uid.slice(0,8) : '';
          await navigator.share({ title: '👻 Ghostub', text: shareText, url: 'https://pimpimshop33-dotcom.github.io/ghostub/' + _refParam });
        } catch(e) { if (e.name !== 'AbortError') console.warn('[ghostub:shareMap]', e); }
      } else {
        _downloadCanvas(canvas, 'ghostub-lieu.png');
      }
      if (btn) { btn.textContent = t.map_share_btn || '↗ Partager'; btn.disabled = false; }
    }, 'image/png');

  } catch(e) {
    console.warn('shareMapLocation:', e);
    if (btn) { btn.textContent = t.map_share_btn || '↗ Partager'; btn.disabled = false; }
  }
};

function _downloadCanvas(canvas, name) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name; a.click();
}

function buildShareLink(ghost) {
  // Pointer vers la landing page mystère
  const base = 'https://pimpimshop33-dotcom.github.io/ghostub/ghost.html';
  const params = new URLSearchParams({
    id: ghost.id,
    lat: ghost.lat ? ghost.lat.toFixed(5) : '',
    lng: ghost.lng ? ghost.lng.toFixed(5) : '',
    loc: ghost.location || 'Lieu mystérieux',
    emoji: ghost.emoji || '👻'
  });
  if (currentUser) params.set('ref', currentUser.uid.slice(0, 8));
  return base + '?' + params.toString();
}


// ── GHOST CARD GENERATOR ──────────────────────────────────

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
// ── Fond nuit urbaine ────────────────────────────────
function _drawGhostCardBackground(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   '#020408');
  bg.addColorStop(0.4, '#060c18');
  bg.addColorStop(1,   '#020308');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Pluie fine
  const rng = (s) => { let x = Math.sin(s)*10000; return x - Math.floor(x); };
  for (let i = 0; i < 120; i++) {
    const x = rng(i*7.3)*W;
    const y = rng(i*13.7)*H;
    const len = rng(i*2.1)*40 + 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len*0.15, y + len);
    ctx.strokeStyle = `rgba(160,185,230,${rng(i*5.9)*0.25 + 0.08})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Halo réverbère en haut
  const lamp1 = ctx.createRadialGradient(W*0.3, H*0.18, 0, W*0.3, H*0.18, 300);
  lamp1.addColorStop(0, 'rgba(255,230,120,0.22)');
  lamp1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp1; ctx.fillRect(0, 0, W, H);
  const lamp2 = ctx.createRadialGradient(W*0.72, H*0.22, 0, W*0.72, H*0.22, 280);
  lamp2.addColorStop(0, 'rgba(255,230,120,0.18)');
  lamp2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp2; ctx.fillRect(0, 0, W, H);

  // Brume centrale
  const mist = ctx.createRadialGradient(W/2, H*0.45, 0, W/2, H*0.45, 520);
  mist.addColorStop(0, 'rgba(140,170,220,0.14)');
  mist.addColorStop(0.6, 'rgba(100,130,180,0.06)');
  mist.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mist; ctx.fillRect(0, 0, W, H);

  // Sol mouillé en bas
  const puddle = ctx.createLinearGradient(0, H*0.72, 0, H);
  puddle.addColorStop(0, 'rgba(0,0,0,0)');
  puddle.addColorStop(0.5, 'rgba(30,50,90,0.25)');
  puddle.addColorStop(1, 'rgba(10,20,40,0.5)');
  ctx.fillStyle = puddle; ctx.fillRect(0, H*0.72, W, H*0.28);

  // Reflet réverbère sur sol
  const refl = ctx.createRadialGradient(W/2, H*0.88, 0, W/2, H*0.88, 200);
  refl.addColorStop(0, 'rgba(255,220,100,0.18)');
  refl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = refl; ctx.fillRect(0, H*0.75, W, H*0.25);
}

// ── Header app ────────────────────────────────────────
function _drawGhostCardHeader(ctx, W, ghostBlueRgb) {
  ctx.textAlign = 'center';
  ctx.letterSpacing = '8px';
  ctx.fillStyle = `rgba(${ghostBlueRgb},0.45)`;
  ctx.font = '400 36px "Instrument Sans", sans-serif';
  ctx.fillText('GHOSTUB', W/2, 100);
  ctx.letterSpacing = '0px';

  // Séparateur haut
  ctx.strokeStyle = `rgba(${ghostBlueRgb},0.12)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 128); ctx.lineTo(W-100, 128); ctx.stroke();
}

// ── Ghost mark avec glow ──────────────────────────────
function _drawGhostCardMark(ctx, W, H, ghostBlueRgb) {
  ctx.shadowColor = `rgba(${ghostBlueRgb},0.7)`;
  ctx.shadowBlur = 80;
  const ghostEmoji = selectedGhost.emoji && selectedGhost.emoji !== '👻' ? selectedGhost.emoji : null;
  if (ghostEmoji) {
    ctx.font = '220px serif';
    ctx.fillText(ghostEmoji, W/2, H*0.38);
  } else {
    const sz = 220;
    ctx.drawImage(_brandImg, W/2 - sz/2, H*0.38 - sz*0.75, sz, sz);
  }
  ctx.shadowBlur = 0;
}

// ── Message mystère (pas le texte — le FOMO) ──────────
function _drawGhostCardMessage(ctx, W, H, ghostBlueRgb) {
  ctx.fillStyle = 'rgba(230,228,255,0.88)';
  ctx.font = 'italic 68px "Cormorant Garamond", Georgia, serif';
  const line1 = _currentLang === 'en' ? 'A message is waiting for you' : 'Un message attend quelqu’un ici';
  ctx.fillText(line1, W/2, H*0.52);

  // Nombre de personnes qui peuvent encore l'ouvrir
  const remaining = selectedGhost.maxOpenCount
    ? Math.max(0, selectedGhost.maxOpenCount - (selectedGhost.openCount || 0))
    : null;
  if (remaining !== null && remaining > 0) {
    ctx.fillStyle = 'rgba(255,180,60,0.85)';
    ctx.font = 'italic 48px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? `Only ${remaining} can still open it` : `Plus que ${remaining} personne${remaining > 1 ? 's' : ''} peut l'ouvrir`, W/2, H*0.52 + 80);
  } else {
    ctx.fillStyle = `rgba(${ghostBlueRgb},0.55)`;
    ctx.font = 'italic 48px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? '…but only if you are close enough' : '…mais seulement si tu t’en approches', W/2, H*0.52 + 80);
  }
}

// ── Lieu (flou volontaire pour le mystère) ────────────
function _drawGhostCardLocation(ctx, W, H, premiumRgb) {
  const lieu = selectedGhost.location || (_currentLang === 'en' ? 'Unknown place' : 'Lieu inconnu');
  const lieuShort = lieu.length > 32 ? lieu.substring(0, 30) + '…' : lieu;
  ctx.fillStyle = 'rgba(255,240,200,0.7)';
  ctx.font = '500 46px "Instrument Sans", sans-serif';
  ctx.fillText('📍 ' + lieuShort, W/2, H*0.63);

  // Distance et résonances
  const resoCount = selectedGhost.resonances || 0;
  if (resoCount > 0) {
    ctx.fillStyle = `rgba(${premiumRgb},0.65)`;
    ctx.font = '38px "Instrument Sans", sans-serif';
    ctx.fillText('✦'.repeat(Math.min(resoCount, 5)) + ` — ${resoCount} résonance${resoCount > 1 ? 's' : ''}`, W/2, H*0.69);
  }
}

// ── CTA viral ─────────────────────────────────────────
function _drawGhostCardCTA(ctx, W, H, ghostBlueRgb) {
  // Fond pill pour le CTA
  ctx.fillStyle = `rgba(${ghostBlueRgb},0.12)`;
  const pillY = H*0.78;
  _roundRect(ctx, W/2 - 360, pillY - 50, 720, 110, 55);
  ctx.fill();
  ctx.strokeStyle = `rgba(${ghostBlueRgb},0.25)`;
  ctx.lineWidth = 1.5;
  _roundRect(ctx, W/2 - 360, pillY - 50, 720, 110, 55);
  ctx.stroke();

  ctx.fillStyle = 'rgba(200,215,255,0.9)';
  ctx.font = '500 40px "Instrument Sans", sans-serif';
  ctx.fillText(_currentLang === 'en' ? 'Come and open it on Ghostub' : 'Viens l’ouvrir sur Ghostub', W/2, pillY + 15);
}

function _drawGhostCardFooter(ctx, W, H, ghostBlueRgb) {
  // Séparateur bas
  ctx.strokeStyle = `rgba(${ghostBlueRgb},0.10)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, H - 130); ctx.lineTo(W-100, H - 130); ctx.stroke();

  // URL
  ctx.fillStyle = `rgba(${ghostBlueRgb},0.3)`;
  ctx.font = '28px "Instrument Sans", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('ghostub.app', W/2, H - 80);
  ctx.letterSpacing = '0px';
}

// ── Export ────────────────────────────────────────────
function _exportGhostCard(canvas, btn) {
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'ghostcard.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: '👻 Ghost Card — Ghostub',
          text: _currentLang === 'en' ? 'I broke a seal here…' : 'J’ai brisé un sceau ici…'
        });
        Analytics.track('ghost_card_shared');
      } catch(e) {
        if (e.name !== 'AbortError') _downloadGhostCard(canvas);
      }
    } else {
      _downloadGhostCard(canvas);
    }
    if (btn) { btn.textContent = '👻 Créer une Ghost Card'; btn.disabled = false; }
  }, 'image/png');
}

window.generateGhostCard = async () => {
  if (!selectedGhost) return;
  const btn = document.getElementById('ghostCardBtn');
  if (btn) { btn.textContent = '⏳ Génération…'; btn.disabled = true; }

  try {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Canvas 2D n'interprète pas var(--...) (contrairement au DOM/CSSOM) :
    // résoudre la valeur réelle à chaque génération pour rester correct si le thème change.
    const ghostBlueRgb = getComputedStyle(document.documentElement).getPropertyValue('--ghost-blue-rgb').trim();
    const premiumRgb = getComputedStyle(document.documentElement).getPropertyValue('--premium-rgb').trim();

    _drawGhostCardBackground(ctx, W, H);
    _drawGhostCardHeader(ctx, W, ghostBlueRgb);
    _drawGhostCardMark(ctx, W, H, ghostBlueRgb);
    _drawGhostCardMessage(ctx, W, H, ghostBlueRgb);
    _drawGhostCardLocation(ctx, W, H, premiumRgb);
    _drawGhostCardCTA(ctx, W, H, ghostBlueRgb);
    _drawGhostCardFooter(ctx, W, H, ghostBlueRgb);
    _exportGhostCard(canvas, btn);

  } catch(e) {
    console.warn('generateGhostCard:', e);
    if (btn) { btn.textContent = '👻 Créer une Ghost Card'; btn.disabled = false; }
  }
};

function _downloadGhostCard(canvas) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'ghostcard-' + Date.now() + '.png';
  a.click();
  Analytics.track('ghost_card_downloaded');
}

function openShareModal() {
  if (!selectedGhost) return;
  const link = buildShareLink(selectedGhost);
  // Sur mobile : partage natif direct si disponible
  if (navigator.share) {
    navigator.share({
      title: '👻 Fantôme à ' + (selectedGhost.location || 'cet endroit'),
      text: "Un fantôme t'attend ici — approche-toi pour le découvrir.",
      url: link
    }).then(() => Analytics.track('share_native')).catch(() => {
      // Fallback : modal copier
      document.getElementById('shareLinkBox').textContent = link;
      openModal('shareModal', null);
    });
  } else {
    document.getElementById('shareLinkBox').textContent = link;
    openModal('shareModal', null);
  }
  Analytics.track('share_opened');
}
window.openShareModal = openShareModal;

window.closeShareModal = (e) => {
  if (e && e.target !== document.getElementById('shareModal')) return;
  closeModal('shareModal');
};

window.copyShareLink = () => {
  const link = document.getElementById('shareLinkBox').textContent;
  const btn = document.querySelector('.share-copy-btn');
  navigator.clipboard.writeText(link).then(() => {
    if (btn) { btn.textContent = t.toast_copied; btn.style.borderColor = 'rgba(var(--accent-green-rgb),.4)'; setTimeout(() => { btn.textContent = t.share_copy_btn; btn.style.borderColor = ''; }, 2000); }
    showToast('link', t.toast_link_copied);
    closeModal('shareModal');
    Analytics.track('share_copied');
  }).catch(() => {
    showToast('warning', t.toast_share_copy_fallback);
  });
};

window.nativeShare = async () => {
  const link = document.getElementById('shareLinkBox').textContent;
  const ghost = selectedGhost;
  if (navigator.share) {
    try {
      await navigator.share({
        title: '👻 Fantôme à ' + (ghost.location || 'cet endroit'),
        text: "Un fantôme t'attend ici — approche-toi pour le découvrir.",
        url: link
      });
      closeModal('shareModal');
      Analytics.track('share_native');
    } catch(e) { if (e.name !== 'AbortError') console.warn('[ghostub:nativeShare]', e); }
  } else {
    window.copyShareLink();
  }
};

(function handleIncomingLink() {
  const params = new URLSearchParams(window.location.search);
  const ghostId = params.get('ghost');
  if (!ghostId) return;
  const unsub = auth.onAuthStateChanged(user => {
    if (user) {
      unsub();
      setTimeout(() => openGhost(ghostId), 800);
    } else {
      sessionStorage.setItem('pendingGhost', ghostId);
    }
  });
})();

// ── THÈME CLAIR / SOMBRE ─────────────────────────────────
// Détection automatique des préférences système si pas de préférence sauvegardée
function getInitialTheme() {
  const saved = localStorage.getItem('ghostub_theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light-theme', isLight);
  // Mise à jour theme-color dynamique
  const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  // Active le bon
  document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
  const btn = document.getElementById('themeToggleBtn');
  if (btn) { const lbl = document.getElementById('themeToggleLabel'); if (lbl) lbl.textContent = isLight ? t.profile_night_mode : t.profile_day_mode; const ico = btn.querySelector('span'); if (ico) ico.textContent = isLight ? '🌙' : '☀️'; }
  localStorage.setItem('ghostub_theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('ghostub_theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  Analytics.track('theme_toggle', { theme: newTheme });
}
window.toggleTheme = toggleTheme;

// Appliquer le thème sauvegardé (ou système) au démarrage
applyTheme(getInitialTheme());

// Écouter les changements de préférence système
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  if (!localStorage.getItem('ghostub_theme')) {
    applyTheme(e.matches ? 'light' : 'dark');
  }
});

// ── NOTIF RÉSONANCE IMMÉDIATE ────────────────────────────
let _unsubResonances = null;
function watchMyGhostResonances() {
  if (_unsubResonances) { _unsubResonances(); _unsubResonances = null; }
  if (!currentUser) return;
  const q = query(collection(db, COLL.GHOSTS), where('authorUid', '==', currentUser.uid));
  _unsubResonances = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'modified') {
        const g = change.doc.data();
        // v104 : ne pas notifier l'utilisateur pour le welcome ghost (techniquement
        // attribué à son UID pour passer les Firestore Rules, mais ce n'est pas son ghost).
        if (g._welcome) return;
        const id = change.doc.id;
        const prev = parseInt(localStorage.getItem('prev_reso_' + id) || '0');
        const curr = g.resonances || 0;
        if (curr > prev) {
          const lieu = escapeHTML(g.location || 'ce lieu');
          const msg = _resoMessage(lieu, curr);
          _smartNotif(t.notif_reso_title, msg);
          showToast('info', msg, 5000);
          // Vérifier milestones de résonance collective
          _checkResoMilestone(id, lieu, prev, curr);
          localStorage.setItem('prev_reso_' + id, curr);
          if (document.getElementById('screenProfile').classList.contains('active')) {
            refreshProfileStats();
          }
        }
      }
    });
  });
}

// ── MODALE CONFIRMATION ─────────────────────────────────
function showConfirm(title, subtitle, options = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmSubtitle').textContent = subtitle;
    const typedWrap = document.getElementById('confirmTypedWrap');
    const typedInput = document.getElementById('confirmTypedInput');
    const btnOk = document.getElementById('confirmOk');
    const btnCancel = document.getElementById('confirmCancel');

    // Mode saisie obligatoire
    if (options.requireTyped) {
      const expectedWord = t.profile_delete_confirm_word;
      const typedLabel = typedWrap.querySelector('div');
      if (typedLabel) typedLabel.innerHTML = t.profile_delete_confirm_type.replace('{word}', expectedWord);
      typedInput.placeholder = expectedWord;
      typedWrap.style.display = 'block';
      typedInput.value = '';
      btnOk.disabled = true;
      btnOk.style.opacity = '0.35';
      const onType = () => {
        const ok = typedInput.value.trim().toUpperCase() === expectedWord;
        btnOk.disabled = !ok;
        btnOk.style.opacity = ok ? '1' : '0.35';
      };
      typedInput.addEventListener('input', onType);
      setTimeout(() => typedInput.focus(), 80);
      typedInput._cleanup = () => typedInput.removeEventListener('input', onType);
    } else {
      typedWrap.style.display = 'none';
      btnOk.disabled = false;
      btnOk.style.opacity = '1';
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    const cleanup = (result) => {
      modal.classList.remove('show');
      document.body.style.overflow = '';
      if (typedInput._cleanup) { typedInput._cleanup(); delete typedInput._cleanup; }
      btnOk.disabled = false;
      btnOk.style.opacity = '1';
      typedWrap.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    if (!options.requireTyped) setTimeout(() => btnCancel.focus(), 50);
  });
}

window.logout = async () => {
  Analytics.track('logout');
  _stopNotifIntervals();
  if (_unsubResonances) { _unsubResonances(); _unsubResonances = null; }
  // v105 : nettoyer le whisper listener (memory leak + faux notifs cross-comptes)
  if (typeof window._stopWhisperListener === 'function') window._stopWhisperListener();
  // v105 : reset state globals pour éviter pollution entre comptes
  nearbyGhosts = [];
  selectedGhost = null;
  userLat = null;
  userLng = null;
  _depositMode = 'normal';
  window._depositMode = _depositMode;
  await signOut(auth);
};

window.deleteMyGhosts = async () => {
  if (!currentUser) return;
  const confirmed = await showConfirm(
    t.profile_delete_confirm_title,
    t.profile_delete_confirm_sub,
    { requireTyped: true }
  );
  if (!confirmed) return;
  const btn = document.getElementById('deleteBtn');
  btn.textContent = t.dep_deleting || '⏳ Suppression…';
  btn.disabled = true;
  try {
    // Récupérer mes fantômes
    const snap = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid', '==', currentUser.uid)));
    const ghostIds = snap.docs.map(d => d.id);
    const dels = snap.docs.map(d => deleteDoc(doc(db, COLL.GHOSTS, d.id)));

    // FIX: Supprimer mes réponses ET toutes les réponses sur mes fantômes
    const myReplies = await getDocs(query(collection(db, COLL.REPLIES), where('authorUid', '==', currentUser.uid)));
    const rDels = myReplies.docs.map(d => deleteDoc(doc(db, COLL.REPLIES, d.id)));

    // Supprimer aussi les réponses d'autres utilisateurs sur mes fantômes
    const replyDelsOnMyGhosts = [];
    for (const gid of ghostIds.slice(0, 20)) { // limiter à 20 pour éviter trop d'appels
      try {
        const r = await getDocs(query(collection(db, COLL.REPLIES), where('ghostId', '==', gid)));
        r.docs.forEach(d => replyDelsOnMyGhosts.push(deleteDoc(doc(db, COLL.REPLIES, d.id))));
      } catch(e) { console.warn('[ghostub:deleteMyGhosts:replies]', e); }
    }

    await Promise.all([...dels, ...rDels, ...replyDelsOnMyGhosts]);
    const totalDel = snap.size + myReplies.size + replyDelsOnMyGhosts.length;
    btn.textContent = '✓ ' + snap.size + ' ' + (_currentLang === 'fr' ? 'fantômes supprimés' : 'ghosts deleted');
    btn.style.borderColor = 'rgba(var(--accent-green-rgb),.4)';
    btn.style.color = 'rgba(var(--accent-green-rgb),.9)';
    nearbyGhosts = [];
    renderGhostList();
    Analytics.track('delete_all_ghosts', { count: snap.size });
  } catch(e) {
    btn.textContent = t.profile_delete_err;
    btn.disabled = false;
  }
};

// ── EXPORT RGPD (Art. 20 — Portabilité des données) ─────
window.exportMyData = async () => {
  if (!currentUser) return;
  const btn = document.querySelector('[data-action="exportMyData"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Préparation…'; }
  try {
    // 1. Mes fantômes déposés
    const ghostsSnap = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid', '==', currentUser.uid)));
    const ghosts = ghostsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Mes réponses envoyées
    const repliesSnap = await getDocs(query(collection(db, COLL.REPLIES), where('authorUid', '==', currentUser.uid)));
    const replies = repliesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Mes découvertes (localStorage)
    const discoveries = getDiscoveredIds();

    // 4. Mes favoris (localStorage)
    const favorites = getFavorites();

    if (!ghosts.length && !replies.length && !discoveries.length) {
      showToast('info', t.profile_export_empty);
      if (btn) { btn.disabled = false; btn.textContent = t.profile_export_btn; }
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      account: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        premium: isPremium
      },
      ghosts,
      replies,
      discoveredGhostIds: discoveries,
      favorites
    };

    // Téléchargement JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ghostub-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', t.profile_export_ok, 4000);
    Analytics.track('data_exported', { ghosts: ghosts.length, replies: replies.length });
  } catch(e) {
    console.error('exportMyData error:', e);
    const isNetworkErr = e.code === 'unavailable' || e.code === 'deadline-exceeded';
    showToast('error', isNetworkErr ? t.profile_export_err_network : t.profile_export_err_generic);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t.profile_export_btn; }
  }
};

const timeRemaining = g => {
  const raw = GhostService.timeRemaining(g);
  if (!raw || _currentLang === 'fr') return raw;
  // Traduire tous les patterns français → anglais
  return raw
    .replace(/Expire dans (\d+)j/i,     (_, n) => `Expires in ${n}d`)
    .replace(/(\d+)j restants?/i,       (_, n) => `${n}d left`)
    .replace(/(\d+) jour(s?)/i,         (_, n) => `${n} day${parseInt(n)>1?'s':''}`)
    .replace(/(\d+) heure(s?)/i,        (_, n) => `${n} hour${parseInt(n)>1?'s':''}`)
    .replace(/(\d+) minute(s?)/i,       (_, n) => `${n} min`)
    .replace(/(\d+) mois/i,             (_, n) => `${n} month${parseInt(n)>1?'s':''}`)
    .replace(/(\d+) an(s?)/i,           (_, n) => `${n} year${parseInt(n)>1?'s':''}`)
    .replace(/Expir[eé]e?/i,            'Expired')
    .replace(/Permanent/i,              'Permanent')
    .replace(/aujourd'hui/i,            'today')
    .replace(/demain/i,                 'tomorrow')
    .replace(/ce soir/i,                'tonight')
    .replace(/restant(s?)/i,            'left')
    .replace(/dans /i,                  'in ');
};


// ══════════════════════════════════════════════════════════
// FEATURE 1 : FANTÔME GARANTI AU 1er LANCEMENT (v104)
// Refondu : signé "Ghostub" (équipe), stats authentiques à zéro,
// flag _welcome utilisé pour exclure ce ghost des compteurs perso
// du user (ex: watchMyGhostResonances).
// ══════════════════════════════════════════════════════════
async function _seedWelcomeGhost() {
  if (!currentUser || currentUser.isAnonymous) return;
  if (!userLat || !userLng) return;
  const key = 'ghostub_welcomed_' + currentUser.uid;
  if (localStorage.getItem(key)) return;

  try {
    const _wLat = userLat + (Math.random()-0.5)*0.0003;
    const _wLng = userLng + (Math.random()-0.5)*0.0003;
    const fields = buildGeohashFields(_wLat, _wLng);
    await addDoc(collection(db, COLL.GHOSTS), {
      message: _currentLang === 'en'
        ? 'Welcome to Ghostub. Each place around you can hide a message — left by someone who passed before. Walk a little, listen, and you will find them. When you are ready, leave your own trace. Someone, one day, will discover it. — The Ghostub team'
        : 'Bienvenue sur Ghostub. Chaque lieu autour de toi peut cacher un message — laissé par quelqu’un qui est passé avant. Marche un peu, écoute, et tu les trouveras. Quand tu seras prêt, laisse ta propre trace. Quelqu’un, un jour, la découvrira. — L’équipe Ghostub',
      emoji: '👻',
      lat: _wLat,
      lng: _wLng,
      location: _currentLang === 'en' ? 'Right here' : 'Juste ici',
      radius: '30m',
      duration: '7j',
      maxOpenCount: 0,
      anonymous: false,
      author: 'Ghostub',
      authorUid: currentUser.uid, // imposé par les Firestore Rules ; filtré via _welcome côté client
      geohash: fields.geohash5 || fields.geohash,
      geohash4: fields.geohash4,
      expired: false,
      createdAt: serverTimestamp(),
      resonances: 0,
      openCount: 0,
      _welcome: true,
    });
    localStorage.setItem(key, '1');
    // Recharger pour qu'il apparaisse immédiatement
    setTimeout(() => loadNearbyGhosts(), 1200);
  } catch(e) { console.warn('_seedWelcomeGhost:', e); }
}

// ══════════════════════════════════════════════════════════
// FEATURE 2 : FENÊTRES ÉPHÉMÈRES — FOMO NOTIFICATION
// Vérifie périodiquement si un fantôme proche expire bientôt
// ══════════════════════════════════════════════════════════
const _EPHEM_NOTIFIED_KEY = 'ghostub_ephem_notified';

function _checkEphemeralWindows() {
  if (!nearbyGhosts || !nearbyGhosts.length) return;
  const now = Date.now();
  const TWO_H = 7200000;
  let notified = [];
  try { notified = JSON.parse(localStorage.getItem(_EPHEM_NOTIFIED_KEY) || '[]'); } catch(e) { console.warn('[ghostub:_checkEphemeralWindows]', e); }
  const notifiedSet = new Set(notified);

  nearbyGhosts.forEach(g => {
    if (notifiedSet.has(g.id)) return;
    // Fantôme avec date d'expiration calculable (duration connue)
    if (!g.createdAt) return;
    const created = g.createdAt.seconds ? g.createdAt.seconds * 1000 : Date.now();
    const durMap = { '24h': 86400000, '7j': 604800000, '1m': 2592000000 };
    const durMs = durMap[g.duration] || 0;
    if (!durMs) return;
    const expiresAt = created + durMs;
    const remaining = expiresAt - now;
    if (remaining <= 0 || remaining > TWO_H) return;

    // Fantôme qui expire dans moins de 2h — FOMO !
    notifiedSet.add(g.id);
    const mins = Math.round(remaining / 60000);
    const dist = Math.round(g.distance || 0);
    const distStr = dist > 999 ? (dist/1000).toFixed(1)+'km' : dist+'m';
    const timeStr = mins < 60 ? `${mins} min` : `${Math.round(mins/60)}h`;

    showNotif(
      `⏳ ${g.emoji || '👻'} — ${timeStr} restante${mins > 1 ? 's' : ''}`,
      `${_currentLang === 'en'
        ? `A trace at ${distStr} will disappear soon. Be quick.`
        : `Une trace à ${distStr} va disparaître. Fais vite.`}`
    );
    // Toast en app aussi
    showToast('info',
      `⏳ ${g.emoji || '👻'} à ${distStr} — expire dans ${timeStr}`,
      5000
    );
  });

  // Sauvegarder les notifiés (garder les 50 derniers max)
  const arr = [...notifiedSet].slice(-50);
  try { localStorage.setItem(_EPHEM_NOTIFIED_KEY, JSON.stringify(arr)); } catch(e) { console.warn('[ghostub:_checkEphemeralWindows]', e); }
}


// ══════════════════════════════════════════════════════════
// FEATURE : STREAK DE PRÉSENCE PHYSIQUE
// Basé sur les lieux distincts visités, pas juste l'ouverture de l'app
// ══════════════════════════════════════════════════════════

const _PLACE_STREAK_KEY = () => currentUser ? 'ghostub_place_streak_' + currentUser.uid : null;

function _trackPlaceVisit(geohash5) {
  if (!geohash5 || !currentUser) return;
  const key = _PLACE_STREAK_KEY();
  let data;
  try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { data = {}; }

  const weekKey = _currentWeekKey();
  if (!data[weekKey]) data[weekKey] = [];

  // Ajouter le lieu s'il n'est pas déjà visité cette semaine
  if (!data[weekKey].includes(geohash5)) {
    data[weekKey].push(geohash5);
    localStorage.setItem(key, JSON.stringify(data));

    const count = data[weekKey].length;
    // Toast de progression
    if (count === 3) {
      showToast('info', '🔥 3 lieux différents cette semaine — tu explores !', 4000);
    } else if (count === 5) {
      showToast('info', '🔥🔥 5 lieux explorés cette semaine — tu hantes la ville !', 5000);
      showNotif('🔥 Chasseur de fantômes', _currentLang === 'en'
        ? '5 different places this week — you are haunting the city!'
        : '5 lieux différents cette semaine — tu hantes la ville !');
    } else if (count === 10) {
      showToast('info', '👻 10 lieux ! Tu es une légende de la nuit.', 5000);
    }
  }
}

function _currentWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return now.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function _getWeeklyPlaces() {
  const key = _PLACE_STREAK_KEY();
  if (!key) return 0;
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return (data[_currentWeekKey()] || []).length;
  } catch(e) { return 0; }
}

// ══════════════════════════════════════════════════════════
// FEATURE : RÉSONANCE COLLECTIVE — milestones 5, 10, 25, 50
// (RESO_MILESTONES déclaré plus haut avec MILESTONES, cf. Lot L)
// ══════════════════════════════════════════════════════════

function _checkResoMilestone(ghostId, lieu, prev, curr) {
  for (const milestone of RESO_MILESTONES) {
    if (prev < milestone && curr >= milestone) {
      const emoji = milestone >= 50 ? '🌟' : milestone >= 25 ? '✨' : '✦';
      const msg_fr = `${emoji} Ton fantôme à "${lieu}" vient d'atteindre ${milestone} résonances — il touche du monde.`;
      const msg_en = `${emoji} Your ghost at "${lieu}" just reached ${milestone} resonances — it's touching people.`;
      const msg = _currentLang === 'en' ? msg_en : msg_fr;
      _smartNotif(`${emoji} ${milestone} résonances !`, msg);
      showToast('info', msg, 6000);
      HapticsService.milestone();
      break;
    }
  }
}

// ══════════════════════════════════════════════════════════
// FEATURE : BADGE PREMIER DÉPOSANT
// ══════════════════════════════════════════════════════════

async function _checkFirstDepositor(lat, lng, geohash5) {
  if (!currentUser || !geohash5) return null;
  try {
    // Vérifier si des fantômes existent déjà dans ce geohash5
    const existing = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('geohash', '==', geohash5),
      where('expired', '==', false),
      limit(2)
    ));
    // Si aucun autre fantôme → premier déposant !
    const others = existing.docs.filter(d => d.data().authorUid !== currentUser.uid);
    if (others.length === 0) {
      return true;
    }
    return false;
  } catch(e) { return false; }
}

// Ne déclenche la popup GPS native que si le priming a déjà été accepté
// (cf. _maybeShowLocationPrimer) — sinon, sur le tout premier lancement,
// cet appel partirait avant toute explication pendant que l'onboarding
// est encore affiché. On utilise le fallback en attendant _ensureLocationReady().
async function _resolveNearbyGhostsLocation() {
  try {
    if (!window._locationWatchStarted) {
      if (!userLat || !userLng) { userLat = 46.6034; userLng = 1.8883; window._gpsIsFallback = true; }
    } else {
      await getLocation();
      document.querySelector('.ghost-count-line').innerHTML = '<span class="ghost-count-msg">' + t.radar_searching + '</span>';
      window._gpsIsFallback = false;
      document.getElementById('userCoords').textContent =
        userLat.toFixed(4) + '° N, ' + userLng.toFixed(4) + '° E';
    }
  } catch(e) {
    document.querySelector('.ghost-count-line').innerHTML = '<span class="no-gps-msg">' + t.radar_no_gps + ' <button data-action="loadNearbyGhosts" class="no-gps-retry-btn">' + t.radar_retry_btn + '</button></span>';
    // Utiliser la dernière position connue si disponible, sinon centre de France
    if (!userLat || !userLng) {
      userLat = 46.6034; userLng = 1.8883;
      window._gpsIsFallback = true;
    }
    // Si on a déjà une position réelle, on l'utilise sans marquer comme fallback
  }
}

// ── QUERY FIRESTORE (géohash ~15km) ─────────────────────────────────
// WorldService.getVisibleGhosts filtre par geohash (centre + 8 voisins ~15km)
// → coût Firestore proportionnel à la zone, pas à la collection globale
// Retourne null si la requête échoue (l'UI d'erreur est déjà posée) — le
// caller doit alors sortir immédiatement de loadNearbyGhosts.
async function _fetchVisibleGhostsSnapshot() {
  try {
    return await WorldService.getVisibleGhosts(userLat, userLng);
  } catch(firestoreErr) {
    console.error('Firestore error:', firestoreErr);
    showToast('error', t.radar_firestore_err || 'Erreur de chargement.');
    document.querySelector('.ghost-count-line').innerHTML = '<span class="ghost-count-msg-err">' + t.radar_firestore_err + '</span>';
    renderGhostList(); renderRadarDots();
    return null;
  }
}

function _processNearbyGhostsSnapshot(snap) {
  nearbyGhosts = [];
  // Fantômes réels mais hors du rayon "proche" (5-15km) — gardés uniquement pour
  // le teaser de présence (direction + distance), jamais leur contenu ni position exacte.
  window._distantGhostsCache = [];
  snap.forEach(d => {
    const g = { id: d.id, ...d.data() };
    if (g.expired) return;
    if (isExpired(g)) {
      updateDoc(doc(db, COLL.GHOSTS, g.id), { expired: true }).catch(()=>{});
      // Supprimer automatiquement les fantômes expirés depuis plus de 60 jours si on est l'auteur
      if (g.authorUid === currentUser?.uid && g.createdAt) {
        const msSinceCreated = Date.now() - g.createdAt.seconds * 1000;
        const durationMs = 60 * 24 * 3600 * 1000; // 60 jours
        if (msSinceCreated > durationMs) {
          deleteDoc(doc(db, COLL.GHOSTS, g.id)).catch(() => {});
        }
      }
      return;
    }
    if (g.lat && g.lng) {
      g.distance = window._gpsIsFallback ? 0 : distanceMeters(userLat, userLng, g.lat, g.lng);
      if (window._gpsIsFallback || g.distance <= 5000) {
        nearbyGhosts.push(g);
      } else if (!window._gpsIsFallback) {
        window._distantGhostsCache.push({
          dist: g.distance,
          bearing: _bearingDeg(userLat, userLng, g.lat, g.lng),
          emoji: g.secret ? '🔮' : (g.businessMode ? '🏪' : (g.emoji || '👻')),
        });
      }
    }
  });
  nearbyGhosts.sort((a,b) => a.distance - b.distance);
}

// Streak de présence physique — tracker le geohash du lieu actuel
function _trackCurrentPlaceVisit() {
  if (userLat && userLng) {
    const _gf = buildGeohashFields(userLat, userLng);
    if (_gf && _gf.geohash5) {
      _trackPlaceVisit(_gf.geohash5);
      _trackFrequentPlace(_gf.geohash5); // détection lieu fréquenté
    }
  }
}

function _notifySecretGhostsNearby() {
  for (const g of nearbyGhosts) {
    if (g.secret) {
      const key = 'secret_revealed_' + g.id;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        HapticsService.secretRevealed();
        AudioService.playChime(660);
        showNotif(
          `🔮 Fantôme secret de ${g.anonymous ? getPoeticName(g.id) : escapeHTML(g.author || 'quelqu\'un')}`,
          `"${(g.message || '').substring(0, 80)}" — à ${formatDistance(g.distance)}`
        );
        if (currentUser && g.authorUid && g.authorUid !== currentUser.uid) {
          addDoc(collection(db, COLL.DISCOVERIES), {
            ghostId: g.id,
            ghostLocation: g.location || t.detail_location_unknown,
            ghostMessage: (g.message || '').substring(0, 60),
            authorUid: g.authorUid,
            discoveredBy: currentUser.displayName || 'quelqu\'un',
            discoveredByUid: currentUser.uid,
            discoveredAt: serverTimestamp(),
            notified: false
          }).catch(() => {});
        }
      }
    }
  }
}

// Si 0 résultat et qu'il y a des fantômes en base, élargir à 50km
function _widenNearbyGhostsIfEmpty(snap, count) {
  let widened = false;
  if (count === 0 && snap.size > 0) {
    snap.forEach(d => {
      const g = { id: d.id, ...d.data() };
      if (g.expired || !g.lat || !g.lng) return;
      g.distance = distanceMeters(userLat, userLng, g.lat, g.lng);
      if (g.distance <= 15000) { nearbyGhosts.push(g); widened = true; }
    });
    nearbyGhosts.sort((a,b) => a.distance - b.distance);
  }
  return widened;
}

function _updateGhostCountMessage(count, widened) {
  if (count === 0) {
    if (widened && nearbyGhosts.length > 0) {
      document.querySelector('.ghost-count-line').innerHTML = '<span class="ghost-count-msg">' + t.radar_no_ghosts_widened + '</span>';
    } else {
      document.querySelector('.ghost-count-line').innerHTML = '<span class="ghost-count-msg">' + t.radar_no_ghosts + '</span>';
    }
  } else {
    document.querySelector('.ghost-count-line').innerHTML = '<span id="ghostCount">' + count + '</span> ' + (_currentLang === 'fr' ? ('fantôme' + (count > 1 ? 's' : '') + ' dans les alentours') : ('ghost' + (count > 1 ? 's' : '') + ' nearby'));
  }
}

function _renderNearbyGhostsUI(count) {
  // Le ping sonar n'est plus lié au refresh — il suit désormais le passage du
  // faisceau radar sur chaque point (cf. renderRadarDots() / _radarPingLoop).
  const mc = document.getElementById('mapCount');
  if (mc) mc.textContent = count + ' ' + (_currentLang === 'fr' ? 'fantôme(s)' : 'ghost(s)');
  if (map) { map.remove(); map = null; }
  renderGhostList();
  renderRadarDots();
  // Reconstruire la carte si l'écran carte est actif
  if (document.getElementById('screenMap')?.classList.contains('active')) {
    renderStaticMap();
  }
}

function _updateResonanceStatusButton() {
  const resoEl = document.getElementById('resoStatus');
  if (resoEl) {
    if (hasResonatedToday()) {
      resoEl.textContent = '✦ 0';
      resoEl.style.color = 'rgba(var(--ghost-blue-rgb),.25)';
      resoEl.style.borderColor = 'rgba(var(--ghost-blue-rgb),.08)';
    } else {
      resoEl.textContent = '✦ 1';
      resoEl.style.color = 'rgba(var(--ghost-blue-rgb),.7)';
      resoEl.style.borderColor = 'rgba(var(--ghost-blue-rgb),.3)';
    }
  }
}

function _runPostLoadHousekeeping(count) {
  Analytics.track('ghosts_loaded', { count });
  updateRankBar();
  checkForNewGhosts(count);
  // Notification fantôme jamais ouvert (3s après le chargement)
  setTimeout(() => checkVirginGhostNearby(), 3000);
  // Nettoyage des clés prev_reso_* orphelines (fantômes supprimés/expirés)
  cleanOldResoKeys();
}

window.loadNearbyGhosts = async () => {
  // Vérification offline
  if (!navigator.onLine) {
    showToast('warning', t.radar_offline);
  }
  const _gc = document.getElementById('ghostCount'); if (_gc) _gc.textContent = '';
  document.querySelector('.ghost-count-line').innerHTML = '<span class="ghost-count-msg">' + t.radar_locating + '</span>';
  skeletonGhostList();

  await _resolveNearbyGhostsLocation();

  const snap = await _fetchVisibleGhostsSnapshot();
  if (!snap) return;

  _processNearbyGhostsSnapshot(snap);
  _trackCurrentPlaceVisit();
  // Vérifier fenêtres éphémères après chaque chargement
  setTimeout(_checkEphemeralWindows, 500);
  _notifySecretGhostsNearby();

  const count = nearbyGhosts.length;
  const widened = _widenNearbyGhostsIfEmpty(snap, count);
  _updateGhostCountMessage(count, widened);

  _renderNearbyGhostsUI(count);
  _updateResonanceStatusButton();
  _runPostLoadHousekeeping(count);
};

function cleanOldResoKeys() {
  const activeIds = new Set(nearbyGhosts.map(g => g.id));
  Object.keys(localStorage)
    .filter(k => k.startsWith('prev_reso_'))
    .forEach(k => {
      const ghostId = k.slice('prev_reso_'.length);
      if (!activeIds.has(ghostId)) localStorage.removeItem(k);
    });
}

function skeletonGhostList() {
  const list = document.getElementById('ghostList');
  list.innerHTML = [1,2,3].map(() => `
    <div class="ghost-skel">
      <div class="skel-flap"></div>
      <div class="skel-body">
        <div class="skel-emoji"></div>
        <div class="skel-lines">
          <div class="skel-line skel-l1"></div>
          <div class="skel-line skel-l2"></div>
        </div>
        <div class="skel-dist"></div>
      </div>
    </div>`).join('');
}

// ── SURNOMS POÉTIQUES ────────────────────────────────────
const POETIC_ADJ  = ['silencieux','nocturne','perdu','oublié','errant','pâle','lointain','secret','invisible','sombre','brumeux','éphémère'];
const POETIC_NOUN = ['passant','souffle','murmure','reflet','voyageur','ombre','témoin','spectre','visiteur','veilleur','rêveur','fantôme'];
const POETIC_TIME = ["du soir","de l'aube","d'hiver","de minuit","d'automne","du crépuscule","de mars","sans nom","sans visage","d'un instant"];

// Tableaux EN — même index que FR pour cohérence (même ghost = même "persona")
const POETIC_ADJ_EN  = ['silent','nocturnal','lost','forgotten','wandering','pale','distant','secret','invisible','somber','misty','fleeting'];
const POETIC_NOUN_EN = ['wanderer','whisper','murmur','reflection','traveler','shadow','witness','specter','visitor','watcher','dreamer','ghost'];
const POETIC_TIME_EN = ['of the evening','of the dawn','of winter','of midnight','of autumn','of dusk','of march','with no name','with no face','of a moment'];

function getPoeticName(ghostId) {
  let hash = 0;
  for (let i = 0; i < ghostId.length; i++) hash = (hash * 31 + ghostId.charCodeAt(i)) >>> 0;
  if (_currentLang === 'en') {
    const adj  = POETIC_ADJ_EN[hash % POETIC_ADJ_EN.length];
    const noun = POETIC_NOUN_EN[(hash >>> 4) % POETIC_NOUN_EN.length];
    const time = POETIC_TIME_EN[(hash >>> 8) % POETIC_TIME_EN.length];
    return `The ${adj} ${noun} ${time}`;
  }
  const adj  = POETIC_ADJ[hash % POETIC_ADJ.length];
  const noun = POETIC_NOUN[(hash >>> 4) % POETIC_NOUN.length];
  const time = POETIC_TIME[(hash >>> 8) % POETIC_TIME.length];
  return `Le ${noun} ${adj} ${time}`;
}

// ── SONS ─────────────────────────────────────────────────
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { console.warn('[ghostub:_getAudioCtx]', e); }
  }
  return _audioCtx;
}
function playRevealSound() {
  const ctx = _getAudioCtx(); if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // 1. Crack — bruit blanc court (fracture du sceau)
    const bufLen = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const crack = ctx.createBufferSource();
    crack.buffer = buf;
    const crackGain = ctx.createGain();
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass'; crackFilter.frequency.value = 1800; crackFilter.Q.value = 0.8;
    crackGain.gain.setValueAtTime(0.55, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    crack.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(ctx.destination);
    crack.start(now); crack.stop(now + 0.13);
    // 2. Shimmer — harmoniques montantes (magie qui se libère)
    [330, 660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + 1.2);
      g.gain.setValueAtTime(0, now + 0.05);
      g.gain.linearRampToValueAtTime(0.07 - i * 0.015, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + 0.05); osc.stop(now + 1.3);
    });
    // 3. Sub-boom — impact grave
    const sub = ctx.createOscillator(), subG = ctx.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(80, now); sub.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    subG.gain.setValueAtTime(0.18, now); subG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sub.connect(subG); subG.connect(ctx.destination);
    sub.start(now); sub.stop(now + 0.3);
  } catch(e) { console.warn('[ghostub:playRevealSound]', e); }
}
function _launchSealParticles() {
  const canvas = document.getElementById('sealParticles');
  if (!canvas) return;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const CX = W / 2, CY = H * 0.42;
  const COLORS = ['rgba(200,190,255,', 'rgba(var(--ghost-blue-rgb),', 'rgba(255,240,200,', 'rgba(220,200,255,', 'rgba(255,255,255,'];
  const particles = [];
  const COUNT = 68;
  for (let i = 0; i < COUNT; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 2.5 + Math.random() * 6;
    const size = 2 + Math.random() * 5;
    const isShard = Math.random() > 0.6;
    particles.push({
      x: CX, y: CY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 3),
      size,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      decay: 0.013 + Math.random() * 0.018,
      gravity: 0.12 + Math.random() * 0.08,
      isShard,
      rot: Math.random() * Math.PI,
      rotV: (Math.random() - 0.5) * 0.18
    });
  }
  let frame;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.alpha -= p.decay;
      p.rot += p.rotV;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      if (p.isShard) {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color + Math.max(0, p.alpha) + ')';
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.8);
        ctx.lineTo(p.size * 0.5, p.size * 0.9);
        ctx.lineTo(-p.size * 0.5, p.size * 0.9);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color + Math.max(0, p.alpha) + ')';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) frame = requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, W, H); }
  };
  setTimeout(() => { frame = requestAnimationFrame(draw); }, 40);
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, W, H); }, 2800);
}

function playDepositSound() {
  const ctx = _getAudioCtx(); if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Arpège ascendant — ancrage dans l'espace
    [261.6, 329.6, 392, 523.3].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = now + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.7);
    });
    // Shimmer final — le ghost s'ancre
    const shimmer = ctx.createOscillator(), sg = ctx.createGain();
    shimmer.type = 'triangle'; shimmer.frequency.setValueAtTime(880, now + 0.5);
    shimmer.frequency.exponentialRampToValueAtTime(1200, now + 1.4);
    sg.gain.setValueAtTime(0, now + 0.5);
    sg.gain.linearRampToValueAtTime(0.05, now + 0.65);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    shimmer.connect(sg); sg.connect(ctx.destination);
    shimmer.start(now + 0.5); shimmer.stop(now + 1.5);
    // Sub pulse — impact de l'ancrage
    const sub = ctx.createOscillator(), subg = ctx.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(60, now); sub.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    subg.gain.setValueAtTime(0.15, now); subg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sub.connect(subg); subg.connect(ctx.destination);
    sub.start(now); sub.stop(now + 0.35);
  } catch(e) { console.warn('[ghostub:playDepositSound]', e); }
}

function _launchDepositParticles() {
  const canvas = document.getElementById('sealParticles');
  if (!canvas) return;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const CX = W / 2, CY = H / 2;
  // Couleurs dorées/vertes — ancrage, création
  const COLORS = ['rgba(255,210,80,', 'rgba(var(--accent-green-rgb),', 'rgba(255,240,150,', 'rgba(168,255,180,', 'rgba(255,255,200,'];
  const particles = [];
  for (let i = 0; i < 55; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 1.5 + Math.random() * 4.5;
    particles.push({
      x: CX, y: CY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1 - Math.random() * 2,
      size: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      decay: 0.01 + Math.random() * 0.015,
      gravity: 0.06 + Math.random() * 0.05,
      isStar: Math.random() > 0.55,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.12
    });
  }
  let frame;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity; p.vx *= 0.99;
      p.alpha -= p.decay; p.rot += p.rotV;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color + Math.max(0, p.alpha) + ')';
      if (p.isStar) {
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let s = 0; s < 4; s++) {
          const a = (s / 4) * Math.PI * 2;
          const r = s % 2 === 0 ? p.size : p.size * 0.4;
          s === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  };
  frame = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, W, H); }, 3000);
}

// ── FAVORIS ──────────────────────────────────────────────
function getFavKey() { return currentUser ? 'favorites_' + currentUser.uid : 'favorites_anon'; }
function getFavorites() { try { return JSON.parse(localStorage.getItem(getFavKey()) || '[]'); } catch(e) { return []; } }
function isFavorite(ghostId) { return getFavorites().some(f => f.id === ghostId); }

function saveFavorites(favs) { localStorage.setItem(getFavKey(), JSON.stringify(favs)); }

window.toggleFavorite = () => {
  if (!selectedGhost) return;
  const favs = getFavorites();
  const idx = favs.findIndex(f => f.id === selectedGhost.id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    showToast('info', t.toast_fav_removed);
  } else {
    favs.unshift({
      id: selectedGhost.id,
      emoji: selectedGhost.emoji || '👻',
      location: selectedGhost.location || t.detail_location_unknown,
      message: (selectedGhost.message || '').substring(0, 60),
      savedAt: Date.now()
    });
    showToast('success', t.toast_fav_added);
  }
  saveFavorites(favs);
  updateFavoriteBtn();
  updateFavoritesCount();
};

function updateFavoriteBtn() {
  const btn = document.getElementById('favoriteBtn');
  if (!btn || !selectedGhost) return;
  const fav = isFavorite(selectedGhost.id);
  btn.textContent = fav ? t.detail_fav_added : t.detail_fav_add;
  btn.style.color = fav ? 'rgba(var(--premium-rgb),.9)' : 'rgba(var(--premium-rgb),.5)';
  btn.style.borderColor = fav ? 'rgba(var(--premium-rgb),.5)' : 'rgba(var(--premium-rgb),.2)';
  btn.style.background = fav ? 'rgba(var(--premium-rgb),.1)' : 'rgba(var(--premium-rgb),.05)';
}

function updateFavoritesCount() {
  const el = document.getElementById('statFavorites');
  if (el) el.textContent = getFavorites().length;
}

window.toggleFavoritesList = async () => {
  const panel = document.getElementById('favoritesList');
  const content = document.getElementById('favoritesListContent');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  document.getElementById('discoveryHistory').style.display = 'none';
  document.getElementById('depositedList').style.display = 'none';
  panel.style.display = 'block';
  const favs = getFavorites();
  if (favs.length === 0) {
    content.innerHTML = `<div class="fav-empty">${t.misc_no_favorites || 'Aucun favori encore'}</div>`;
    return;
  }
  content.innerHTML = favs.map(f => `
    <div class="fav-row">
      <span class="fav-emoji">${f.emoji && f.emoji !== '👻' ? escapeHTML(f.emoji) : _BRAND_MARK_HTML}</span>
      <div class="fav-info" data-action="openGhost" data-id="${escapeHTML(f.id)}">
        <div class="fav-location">${escapeHTML(f.location)}</div>
        <div class="fav-message">"${escapeHTML(f.message)}"</div>
      </div>
      <button data-action="removeFavorite" data-id="${escapeHTML(f.id)}" aria-label="Retirer des favoris" class="fav-remove-btn">★</button>
    </div>`).join('');
};

window.removeFavorite = (ghostId) => {
  const favs = getFavorites().filter(f => f.id !== ghostId);
  saveFavorites(favs);
  updateFavoritesCount();
  // Rafraîchir directement le contenu sans double toggle
  const content = document.getElementById('favoritesListContent');
  if (!content) return;
  if (favs.length === 0) {
    content.innerHTML = `<div class="fav-empty">${t.misc_no_favorites || 'Aucun favori encore'}</div>`;
  } else {
    content.innerHTML = favs.map(f => `
    <div class="fav-row">
      <span class="fav-emoji">${f.emoji && f.emoji !== '👻' ? escapeHTML(f.emoji) : _BRAND_MARK_HTML}</span>
      <div class="fav-info" data-action="openGhost" data-id="${escapeHTML(f.id)}">
        <div class="fav-location">${escapeHTML(f.location)}</div>
        <div class="fav-message">"${escapeHTML(f.message)}"</div>
      </div>
      <button data-action="removeFavorite" data-id="${escapeHTML(f.id)}" aria-label="Retirer des favoris" class="fav-remove-btn">★</button>
    </div>`).join('');
  }
};

// ── CLASSEMENT PUBLIC ────────────────────────────────────

// ── CARTE EMPREINTE PERSONNELLE ──────────────────────────
let _empreinteMap = null;

function _resetEmpreinteMapContainer(container, loader) {
  // Reset
  if (_empreinteMap) { try { _empreinteMap.remove(); } catch(e){ console.warn('[ghostub:loadEmpreinteMap:reset]', e); } _empreinteMap = null; }
  // Détruire et recréer le div Leaflet pour éviter "Map container is already initialized"
  const oldLeaflet = document.getElementById('empreinteLeaflet');
  if (oldLeaflet) { oldLeaflet.remove(); }
  const newLeaflet = document.createElement('div');
  newLeaflet.id = 'empreinteLeaflet';
  newLeaflet.style.cssText = 'width:100%;height:100%;border-radius:inherit;';
  container.appendChild(newLeaflet);
  if (loader) loader.style.display = 'flex';
}

// Charger Leaflet si pas encore disponible
function _ensureLeafletLoaded() {
  return new Promise((resolve) => {
    if (window.L) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = resolve;
    s.onerror = resolve; // on continue même si ça échoue
    document.head.appendChild(s);
    if (!document.getElementById('leafletCSS')) {
      const css = document.createElement('link');
      css.id = 'leafletCSS';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
  });
}

// 1. Charger les fantômes déposés par l'utilisateur
async function _loadEmpreinteDeposits() {
  const depositSnap = await getDocs(query(
    collection(db, COLL.GHOSTS),
    where('authorUid', '==', currentUser.uid),
    limit(100)
  ));
  const deposits = [];
  depositSnap.forEach(d => {
    const g = d.data();
    if (g.lat && g.lng) deposits.push({ lat: g.lat, lng: g.lng, emoji: _ghostEmojiHTML(g), location: g.location || '?', id: d.id });
  });
  return deposits;
}

// 2. Charger les fantômes découverts (depuis Firestore discoveries)
async function _loadEmpreinteDiscoveries() {
  const discSnap = await getDocs(query(
    collection(db, COLL.DISCOVERIES),
    where('discoveredByUid', '==', currentUser.uid),
    limit(100)
  )).catch(() => null);

  // Fallback : IDs localStorage → chercher lat/lng dans nearbyGhosts ou Firestore
  const discIds = getDiscoveredIds().slice(-50);
  const discoveries = [];
  // On cherche d'abord dans nearbyGhosts (déjà chargés)
  discIds.forEach(id => {
    const found = nearbyGhosts.find(g => g.id === id);
    if (found && found.lat && found.lng) {
      discoveries.push({ lat: found.lat, lng: found.lng, emoji: found.emoji || '👁', location: found.location || '?', id });
    }
  });
  // Compléter avec Firestore pour les fantômes non locaux
  const missingIds = discIds.filter(id => !discoveries.find(d => d.id === id)).slice(0, 20);
  if (missingIds.length > 0) {
    await Promise.all(missingIds.map(async id => {
      try {
        const d = await getDoc(doc(db, COLL.GHOSTS, id));
        if (d.exists()) {
          const g = d.data();
          if (g.lat && g.lng) discoveries.push({ lat: g.lat, lng: g.lng, emoji: g.emoji || '👁', location: g.location || '?', id });
        }
      } catch(e) { console.warn('[ghostub:loadEmpreinteMap:discoveries]', e); }
    }));
  }
  return discoveries;
}

// 3. Centrer la carte sur le barycentre des points + créer l'instance Leaflet
function _buildEmpreinteMapInstance(allPoints, deposits, discoveries) {
  const centerLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
  const centerLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;

  // Utiliser le div persistant (pas de innerHTML sur container)
  const leafletDiv = document.getElementById('empreinteLeaflet');
  _empreinteMap = L.map('empreinteLeaflet', { zoomControl: false, attributionControl: false })
    .setView([centerLat, centerLng], deposits.length + discoveries.length > 5 ? 12 : 14);

  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '© OSM France' }).addTo(_empreinteMap);
}

// 4-5. Marqueurs dépôts (violet lumineux) et découvertes (doré)
function _renderEmpreinteMarkers(deposits, discoveries) {
  deposits.forEach(p => {
    const icon = L.divIcon({
      html: `<div class="empreinte-deposit-marker">${p.emoji}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14], className: ''
    });
    L.marker([p.lat, p.lng], { icon })
      .addTo(_empreinteMap)
      .bindPopup(`<div class="empreinte-popup">👻 <b>${escapeHTML(p.location)}</b><br><span class="empreinte-popup-sub">Votre dépôt</span></div>`);
  });

  discoveries.forEach(p => {
    const icon = L.divIcon({
      html: `<div class="empreinte-discovery-marker"></div>`,
      iconSize: [10, 10], iconAnchor: [5, 5], className: ''
    });
    L.marker([p.lat, p.lng], { icon })
      .addTo(_empreinteMap)
      .bindPopup(`<div class="empreinte-popup">👁 <b>${escapeHTML(p.location)}</b><br><span class="empreinte-popup-sub">Découverte</span></div>`);
  });
}

// Ajuster zoom pour tout voir
function _fitEmpreinteMapBounds(allPoints) {
  if (allPoints.length > 1) {
    const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
    _empreinteMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }
  setTimeout(() => { if (_empreinteMap) _empreinteMap.invalidateSize(); }, 300);
}

// 3b. Ligne de trajet chronologique (dépôts reliés)
function _renderEmpreinteTrail(deposits) {
  if (deposits.length > 1) {
    const trailCoords = deposits.map(p => [p.lat, p.lng]);
    L.polyline(trailCoords, {
      color: 'rgba(var(--ghost-blue-rgb),0.35)',
      weight: 1.5,
      dashArray: '4, 6',
      lineCap: 'round'
    }).addTo(_empreinteMap);
  }
}

// 3c. Heatmap simulée — cercles de chaleur sur les zones actives
function _renderEmpreinteHeatmap(allPoints, deposits) {
  allPoints.forEach(p => {
    // Cercle de chaleur extérieur (glow)
    L.circle([p.lat, p.lng], {
      radius: 60,
      color: 'transparent',
      fillColor: p === deposits.find(d => d.id === p.id)
        ? 'rgba(var(--ghost-blue-rgb),0.08)'
        : 'rgba(var(--premium-rgb),0.06)',
      fillOpacity: 1,
      interactive: false
    }).addTo(_empreinteMap);
  });
}

// 6. Score d'empreinte mystérieux
function _computeAndRenderEmpreinteStats(allPoints, deposits, discoveries, statsEl) {
  const cities = new Set(allPoints.map(p => p.location.split(',')[0])).size;
  const score = Math.round(
    deposits.length * 15 +
    discoveries.length * 8 +
    cities * 12 +
    Math.min(allPoints.length, 20) * 3
  );

  statsEl.innerHTML = `
    <div class="empreinte-stat-box">
      <div class="empreinte-stat-num empreinte-stat-num-ether">${deposits.length}</div>
      <div class="empreinte-stat-label">${t.profile_map_deposits || 'Dépôts'}</div>
    </div>
    <div class="empreinte-stat-box">
      <div class="empreinte-stat-num empreinte-stat-num-gold">${discoveries.length}</div>
      <div class="empreinte-stat-label">${t.profile_map_discoveries || 'Découvertes'}</div>
    </div>
    <div class="empreinte-stat-box">
      <div class="empreinte-stat-num empreinte-stat-num-green">${cities}</div>
      <div class="empreinte-stat-label">${t.profile_map_places || 'Lieux'}</div>
    </div>
    <div class="empreinte-stat-box-last">
      <div class="empreinte-stat-num empreinte-stat-num-blue">✦${score}</div>
      <div class="empreinte-stat-label">${t.profile_map_score || 'Score'}</div>
    </div>`;
}

window.loadEmpreinteMap = async () => {
  if (!currentUser) return;
  const container = document.getElementById('empreinteMap');
  const loader    = document.getElementById('empreinteLoader');
  const statsEl   = document.getElementById('empreinteStats');
  if (!container) return;

  _resetEmpreinteMapContainer(container, loader);
  await _ensureLeafletLoaded();

  try {
    const deposits = await _loadEmpreinteDeposits();
    const discoveries = await _loadEmpreinteDiscoveries();

    const allPoints = [...deposits, ...discoveries];
    if (loader) loader.style.display = 'none';

    if (allPoints.length === 0) {
      if (loader) loader.style.display = 'flex';
      loader.innerHTML = '<div class="empreinte-loader-empty-icon">' + _BRAND_MARK_HTML + '</div><div class="empreinte-loader-empty-text">' + t.profile_map_empty + '</div>';
      return;
    }

    if (loader) loader.style.display = 'none';
    _buildEmpreinteMapInstance(allPoints, deposits, discoveries);
    _renderEmpreinteMarkers(deposits, discoveries);
    _fitEmpreinteMapBounds(allPoints);
    _renderEmpreinteTrail(deposits);
    _renderEmpreinteHeatmap(allPoints, deposits);

    if (loader) loader.style.display = 'none';
    _computeAndRenderEmpreinteStats(allPoints, deposits, discoveries, statsEl);

    // Afficher bouton partage si Web Share API dispo
    const shareBtn = document.getElementById('empreinteShareBtn');
    if (shareBtn && navigator.share) shareBtn.style.display = 'block';

  } catch(e) {
    console.error('Empreinte error:', e);
    if (loader) loader.style.display = 'none';
    if (loader) { loader.style.display = 'flex'; loader.innerHTML = `<div class="empreinte-loader-err-icon">⚠️</div><div class="empreinte-loader-err-text">${t.profile_map_error || 'Impossible de charger'}</div>`; }
  }
};

window.shareEmpreinte = async () => {
  const deposits = document.querySelector('#empreinteStats div:nth-child(1) .stat-num, #empreinteStats div:nth-child(1) div')?.textContent || '?';
  const profileUrl = currentUser ? `https://pimpimshop33-dotcom.github.io/ghostub/?profil=${currentUser.uid}` : 'https://pimpimshop33-dotcom.github.io/ghostub/';
  try {
    await navigator.share({
      title: '👻 Mon empreinte Ghostub',
      text: _currentLang === 'en' ? `I've left traces in ${deposits} places with Ghostub — secret messages anchored in real locations. Come closer.` : `J'ai laissé des traces dans ${deposits} lieux avec l'app Ghostub — des messages secrets ancrés dans des endroits réels. Approchez-vous.`,
      url: profileUrl
    });
    Analytics.track('empreinte_shared');
  } catch(e) {
    // Fallback : copier le lien
    try { await navigator.clipboard.writeText(profileUrl); showToast('success', t.toast_copied, 2500); } catch(e2) {}
  }
};

// ── PARTAGE PROFIL PUBLIC ─────────────────────────────────────────

// ── MON ANNÉE GHOSTUB ────────────────────────────────────
// Collecter les données
async function _collectYearCardStats() {
  const discovered = getDiscoveryCount();
  const deposited  = Math.max(
    parseInt(localStorage.getItem('ghostub_total_deposited_' + (currentUser?.uid || 'anon')) || '0'),
    parseInt(document.getElementById('statDeposited')?.textContent || '0')
  );
  const resonances = parseInt(document.getElementById('statResonances')?.textContent || '0');
  const firstReads = parseInt(document.getElementById('statFirstReader')?.textContent || '0');
  const streak     = _getStreak().count;
  const rank       = getRank(discovered);
  const name       = currentUser?.displayName || 'Chasseur';

  // Données Firestore pour le lieu le plus visité
  let topLocation = '';
  try {
    const snap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      orderBy('openCount', 'desc'),
      limit(1)
    ));
    if (!snap.empty) topLocation = snap.docs[0].data().location || '';
  } catch(e) { console.warn('[ghostub:generateYearCard:topLocation]', e); }

  return { discovered, deposited, resonances, firstReads, streak, rank, name, topLocation };
}

// ── Fond ─────────────────────────────────────────────
function _drawYearCardBackground(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#06040e');
  bg.addColorStop(0.4, '#0d0820');
  bg.addColorStop(1,   '#04030c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Étoiles
  for (let i = 0; i < 200; i++) {
    const sx = (Math.sin(i*7.3)*0.5+0.5)*W;
    const sy = (Math.sin(i*13.7)*0.5+0.5)*H;
    const sr = (Math.sin(i*3.1)*0.5+0.5)*1.8+0.2;
    const sa = 0.1+(Math.sin(i*5.9)*0.5+0.5)*0.5;
    ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2);
    ctx.fillStyle = `rgba(200,210,255,${sa})`; ctx.fill();
  }

  // Halos
  [[W*0.25,H*0.35,'rgba(120,80,255,0.15)'],[W*0.75,H*0.6,'rgba(80,160,255,0.1)']].forEach(([x,y,c])=>{
    const h = ctx.createRadialGradient(x,y,0,x,y,300);
    h.addColorStop(0,c); h.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=h; ctx.fillRect(0,0,W,H);
  });
}

function _drawYearCardHeader(ctx, W, name, rank) {
  ctx.textAlign = 'center';

  // App name
  ctx.fillStyle = 'rgba(var(--ghost-blue-rgb),0.4)';
  ctx.font = '500 34px "Instrument Sans", sans-serif';
  ctx.fillText('GHOSTUB', W/2, 110);

  // Ligne déco
  ctx.strokeStyle = 'rgba(var(--ghost-blue-rgb),0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80,140); ctx.lineTo(W-80,140); ctx.stroke();

  // Titre
  ctx.fillStyle = 'rgba(var(--premium-rgb),0.85)';
  ctx.font = 'italic 62px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(_currentLang === 'en' ? 'My year in ghosts' : 'Mon année en fantômes', W/2, 230);

  // Nom + rang
  ctx.fillStyle = 'rgba(230,225,255,0.9)';
  ctx.font = '500 44px "Instrument Sans", sans-serif';
  ctx.fillText(name, W/2, 310);
  ctx.fillStyle = 'rgba(var(--ghost-blue-rgb),0.5)';
  ctx.font = '34px "Instrument Sans", sans-serif';
  ctx.fillText(rank.icon + ' ' + rank.label, W/2, 370);

  // Ligne déco milieu
  ctx.strokeStyle = 'rgba(var(--premium-rgb),0.15)';
  ctx.beginPath(); ctx.moveTo(120,420); ctx.lineTo(W-120,420); ctx.stroke();
}

// Stats grandes
function _drawYearCardStats(ctx, W, H, discovered, deposited, resonances) {
  const stats = [
    { num: discovered, label: _currentLang === 'en' ? 'seals broken' : 'sceaux brisés', icon: '🔮', y: 560 },
    { num: deposited,  label: _currentLang === 'en' ? 'ghosts invoked' : 'fantômes invoqués', icon: '👻', y: 760 },
    { num: resonances, label: _currentLang === 'en' ? 'resonances given' : 'résonances données', icon: '✦', y: 960 },
  ];

  stats.forEach(({ num, label, icon, y }) => {
    // Halo derrière le chiffre
    const sh = ctx.createRadialGradient(W/2,y-40,0,W/2,y-40,120);
    sh.addColorStop(0,'rgba(168,180,255,0.08)'); sh.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(0,0,W,H);

    ctx.fillStyle = 'rgba(230,225,255,0.95)';
    ctx.font = `bold ${num >= 100 ? 110 : 130}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(String(num), W/2, y);

    ctx.fillStyle = 'rgba(var(--ghost-blue-rgb),0.65)';
    ctx.font = 'italic 40px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(icon + '  ' + label, W/2, y+60);
  });
}

function _drawYearCardExtras(ctx, W, streak, firstReads, topLocation) {
  // Extras
  ctx.strokeStyle = 'rgba(var(--ghost-blue-rgb),0.1)';
  ctx.beginPath(); ctx.moveTo(120,1080); ctx.lineTo(W-120,1080); ctx.stroke();

  const extras = [];
  if (streak >= 2) extras.push(`🔥 ${streak} jours de streak`);
  if (firstReads > 0) extras.push(`🥇 ${firstReads} premier${firstReads>1?'s':''} lecteur${firstReads>1?'s':''}`);
  if (topLocation) extras.push(`📍 ${topLocation.substring(0,30)}`);

  ctx.fillStyle = 'rgba(var(--premium-rgb),0.6)';
  ctx.font = '36px "Instrument Sans", sans-serif';
  extras.forEach((e, i) => ctx.fillText(e, W/2, 1160 + i*70));
}

function _drawYearCardFooter(ctx, W, H) {
  // Ligne bas
  ctx.strokeStyle = 'rgba(var(--ghost-blue-rgb),0.12)';
  ctx.beginPath(); ctx.moveTo(80,H-150); ctx.lineTo(W-80,H-150); ctx.stroke();

  // CTA
  ctx.fillStyle = 'rgba(var(--ghost-blue-rgb),0.35)';
  ctx.font = '32px "Instrument Sans", sans-serif';
  ctx.fillText(_currentLang === 'en' ? 'And you, what did you leave this year?' : 'Et toi, qu’est-ce que tu as laissé cette année ?', W/2, H-100);
  ctx.fillStyle = 'rgba(var(--ghost-blue-rgb),0.2)';
  ctx.font = '28px "Instrument Sans", sans-serif';
  ctx.fillText('ghostub.app', W/2, H-55);
}

// Export
function _exportYearCard(canvas, btn, discovered, deposited) {
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'mon-annee-ghostub.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: _currentLang === 'en' ? '✨ My Ghostub Year' : '✨ Mon année Ghostub',
          text: _currentLang === 'en'
            ? `${discovered} seals broken, ${deposited} ghosts invoked. #Ghostub`
            : `${discovered} sceaux brisés, ${deposited} fantômes invoqués. #Ghostub`
        });
        Analytics.track('year_card_shared');
      } catch(e) {
        if (e.name !== 'AbortError') _downloadCanvas(canvas, 'mon-annee-ghostub.png');
      }
    } else {
      _downloadCanvas(canvas, 'mon-annee-ghostub.png');
    }
    if (btn) { btn.textContent = t.profile_year_btn || (t.lang === 'en' ? '❆ My year' : '❆ Mon année'); btn.disabled = false; }
  }, 'image/png');
}

window.generateYearCard = async () => {
  const btn = document.getElementById('yearCardBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('italic 72px "Cormorant Garamond"'),
      document.fonts.load('500 36px "Instrument Sans"')
    ]);

    const { discovered, deposited, resonances, firstReads, streak, rank, name, topLocation } = await _collectYearCardStats();

    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    _drawYearCardBackground(ctx, W, H);
    _drawYearCardHeader(ctx, W, name, rank);
    _drawYearCardStats(ctx, W, H, discovered, deposited, resonances);
    _drawYearCardExtras(ctx, W, streak, firstReads, topLocation);
    _drawYearCardFooter(ctx, W, H);
    _exportYearCard(canvas, btn, discovered, deposited);

  } catch(e) {
    console.warn('generateYearCard:', e);
    if (btn) { btn.textContent = t.profile_year_btn || (t.lang === 'en' ? '❆ My year' : '❆ Mon année'); btn.disabled = false; }
  }
};

window.shareMyProfile = async () => {
  if (!currentUser) return;
  const url = `https://pimpimshop33-dotcom.github.io/ghostub/?profil=${currentUser.uid}`;
  try {
    await navigator.share({ title: t.share_profile_text, text: t.share_profile_text, url });
  } catch(e) {
    try { await navigator.clipboard.writeText(url); showToast('success', t.toast_copied, 2500); } catch(e2) {}
  }
};

window.checkPublicProfileParam = async () => {
  const uid = new URLSearchParams(window.location.search).get('profil');
  if (!uid) return;
  try {
    const userDoc = await getDoc(doc(db, COLL.USERS, uid));
    const name = userDoc.exists() ? (userDoc.data().displayName || (t.profile_ghost_hunter || 'Chasseur de fantômes')) : (t.profile_ghost_hunter || 'Chasseur de fantômes');
    const ghostsSnap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', uid),
      where('anonymous', '==', false),
      limit(100)
    ));
    const ghostCount = ghostsSnap.size;
    const totalOpens = ghostsSnap.docs.reduce((s, d) => s + (d.data().openCount || 0), 0);
    showPublicProfileModal(uid, name, ghostCount, totalOpens, ghostsSnap.docs);
  } catch(e) { console.warn('checkPublicProfileParam:', e); }
};

window.showPublicProfileModal = (uid, name, ghostCount, totalOpens, ghostDocs) => {
  const existing = document.getElementById('publicProfileModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'publicProfileModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(6,6,14,.95);backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;padding:32px 20px;overflow-y:auto;';
  const initial = name.charAt(0).toUpperCase();
  modal.innerHTML = `
    <button data-action="closePublicProfileModal" class="ppm-close-btn">✕</button>
    <div class="ppm-avatar-initial">${initial}</div>
    <div class="ppm-name">${escapeHTML(name)}</div>
    <div class="ppm-subtitle">Chasseur de fantômes</div>
    <div class="ppm-stats-grid">
      <div class="ppm-stat-box">
        <div class="ppm-stat-num">${ghostCount}</div>
        <div class="ppm-stat-label">${t.profile_stat_deposited_label || 'Fantômes déposés'}</div>
      </div>
      <div class="ppm-stat-box">
        <div class="ppm-stat-num">${totalOpens}</div>
        <div class="ppm-stat-label">${t.profile_stat_opens_label || 'Ouvertures totales'}</div>
      </div>
    </div>
    <div class="ppm-section-label">${t.profile_public_footprint || '🗺 Empreinte publique'}</div>
    <div id="publicEmpreinteMap" class="ppm-map"></div>
    <button data-action="joinGhostub" class="ppm-join-btn">${t.profile_join_ghostub || '👻 Rejoindre Ghostub'}</button>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const mapEl = document.getElementById('publicEmpreinteMap');
    if (!mapEl || !ghostDocs.length) return;
    const coords = ghostDocs.filter(d => d.data().lat && d.data().lng).map(d => [d.data().lat, d.data().lng]);
    if (!coords.length) { mapEl.innerHTML = `<div class="ppm-map-empty">${t.profile_no_public_places || t.profile_no_public_place || 'Aucun lieu public'}</div>`; return; }
    const pubMap = L.map('publicEmpreinteMap', { zoomControl: false, attributionControl: false }).setView(coords[0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM France' }).addTo(pubMap);
    coords.forEach(([lat, lng], i) => {
      const g = ghostDocs[i] && ghostDocs[i].data ? ghostDocs[i].data() : {};
      const emHtml = _ghostEmojiHTML(g);
      L.marker([lat, lng], { icon: L.divIcon({ html: '<div class="ppm-marker-emoji">' + emHtml + '</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(pubMap);
    });
    if (coords.length > 1) pubMap.fitBounds(coords, { padding: [20, 20], maxZoom: 14 });
    setTimeout(() => pubMap.invalidateSize(), 300);
  }, 200);
};

let _leaderboardLoaded = false;
window.toggleLeaderboard = async () => {
  const panel = document.getElementById('leaderboardPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  if (!_leaderboardLoaded) { await loadLeaderboard(); _leaderboardLoaded = true; }
};

window.loadLeaderboard = async () => {
  const el = document.getElementById('leaderboardContent');
  if (!el) return;
  el.innerHTML = `<div class="leaderboard-msg">${t.loading || 'Chargement…'}</div>`;
  try {
    // Lire directement les compteurs dénormalisés sur users (1 requête légère)
    const snap = await getDocs(query(
      collection(db, COLL.USERS),
      where('totalResonances', '>', 0),
      orderBy('totalResonances', 'desc'),
      limit(10)
    ));
    const sorted = [];
    snap.forEach(d => {
      const u = d.data();
      if (!u.displayName && !u.email) return;
      sorted.push({
        name: u.displayName || u.email,
        resonances: u.totalResonances || 0,
        ghosts: u.ghostCount || 0
      });
    });
    if (sorted.length === 0) {
      el.innerHTML = `<div class="leaderboard-msg-italic">${t.profile_no_hunters || 'Aucun chasseur encore…'}</div>`;
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = sorted.map((s, i) => {
      const isMe = currentUser && s.name === (currentUser.displayName || currentUser.email);
      return `<div class="leaderboard-row${isMe ? ' leaderboard-row--me' : ''}">
        <span class="leaderboard-medal">${medals[i] || (i+1)+'.'}</span>
        <div class="leaderboard-info">
          <div class="leaderboard-name${isMe ? ' leaderboard-name--me' : ''}">${escapeHTML(s.name)}${isMe ? ' (' + (t.profile_you || 'vous') + ')' : ''}</div>
          <div class="leaderboard-ghosts">${s.ghosts} ${_currentLang === 'fr' ? 'fantôme' + (s.ghosts > 1 ? 's' : '') : 'ghost' + (s.ghosts > 1 ? 's' : '')}</div>
        </div>
        <div class="leaderboard-resonances">✦ ${s.resonances}</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="leaderboard-msg">${t.profile_leaderboard_error || 'Impossible de charger le classement.'}</div>`;
  }
};

// ── FILTRES RADAR ────────────────────────────────────────
let activeFilter = 'all';

window.setFilter = (filter, btn) => {
  activeFilter = filter;
  // Scopé au Radar : la Carte a ses propres boutons .filter-btn (Lot I4,
  // cf. setMapFilter) avec un état indépendant, ne pas se marcher dessus.
  document.querySelectorAll('#screenRadar .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGhostList();
  Analytics.track('filter_used', { filter });
};

// ── FILTRES CARTE (Lot I4) — indépendants du Radar, même logique de filtrage
let _mapActiveFilter = 'all';
window.setMapFilter = (filter, btn) => {
  _mapActiveFilter = filter;
  document.querySelectorAll('.map-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // NB: `map` (pas `window.map`, jamais assigné) est la variable de module
  // qui référence l'instance Leaflet — cf. buildLeafletMap().
  if (map) renderStaticMap();
  Analytics.track('map_filter_used', { filter });
};

// Partagé par le Radar (getFilteredGhosts) et la Carte (Lot I4, setMapFilter) :
// mêmes filtres Toutes/Récentes/Visions/Voix/Vidéos sur la même liste source.
function _filterGhostsByType(list, filter) {
  switch (filter) {
    case 'recent':
      return [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    case 'photo':
      return list.filter(g => g.photoUrl);
    case 'audio':
      return list.filter(g => g.audioUrl);
    case 'video':
      return list.filter(g => g.videoUrl);
    default:
      return list;
  }
}

function getFilteredGhosts() {
  if (activeFilter === 'all') {
    // 'all' = virgins en tête (jamais ouverts), puis par distance dans chaque groupe
    return [...nearbyGhosts].sort((a, b) => {
      const aV = !a.openCount || a.openCount === 0;
      const bV = !b.openCount || b.openCount === 0;
      if (aV !== bV) return aV ? -1 : 1;
      return a.distance - b.distance;
    });
  }
  return _filterGhostsByType(nearbyGhosts, activeFilter);
}


// ── Fantômes grisés à 5km — teaser quand liste vide ──────
// Cap réel (0-360°) entre deux points GPS — utilisé pour le teaser de présence honnête.
function _bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function _bearingToCardinal(deg) {
  const dirs = _currentLang === 'en'
    ? ['North','North-East','East','South-East','South','South-West','West','North-West']
    : ['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'];
  return dirs[Math.round(deg / 45) % 8];
}

function _renderDistantGhostsTeaser() {
  // Honnête : on ne montre que des fantômes réellement présents en base (5-15km),
  // jamais leur contenu ni position exacte — juste direction + distance réelles.
  // S'il n'y en a vraiment aucun, on ne montre rien plutôt que d'en inventer.
  if (!userLat || !userLng) return '';
  const real = (window._distantGhostsCache || []).slice().sort((a,b) => a.dist - b.dist).slice(0, 3);
  if (real.length === 0) return '';
  const label = _currentLang === 'en' ? 'Real presences exist nearby — get closer' : 'De vraies présences existent aux alentours — approche-toi';
  const items = real.map(d => `
    <div class="distant-teaser-row">
      <span class="distant-teaser-emoji">${d.emoji && d.emoji !== '👻' ? escapeHTML(d.emoji) : _BRAND_MARK_HTML}</span>
      <span class="distant-teaser-label">??? — ${_bearingToCardinal(d.bearing)}</span>
      <span class="distant-teaser-dist">${d.dist > 999 ? (d.dist/1000).toFixed(1)+'km' : Math.round(d.dist)+'m'}</span>
    </div>`).join('');
  return `
    <div class="distant-teaser-block">
      <div class="distant-teaser-heading">${label}</div>
      <div class="distant-teaser-list">${items}</div>
    </div>`;
}

function renderGhostList() {
  const list = document.getElementById('ghostList');
  const wrap = document.getElementById('ghostListWrap');
  const filtered = getFilteredGhosts();
  if (nearbyGhosts.length === 0) {
    const isFirstTime = getDiscoveryCount() === 0;
    if (wrap) wrap.classList.toggle('is-welcome', isFirstTime);
    list.innerHTML = isFirstTime ? `
      <div class="radar-welcome-block">
        <div class="radar-welcome-icon">${_BRAND_MARK_HTML}</div>
        <div class="radar-welcome-title">${t.radar_welcome_title}</div>
        <div class="radar-welcome-sub">${t.radar_welcome_sub}</div>
        <div class="radar-welcome-howto-box">
          <div class="radar-welcome-howto-label">${t.radar_how_title}</div>
          <div class="radar-welcome-howto-list">
            <div class="radar-welcome-howto-row">
              <span class="radar-welcome-howto-icon">📍</span><span>${t.radar_how1}</span>
            </div>
            <div class="radar-welcome-howto-row">
              <span class="radar-welcome-howto-icon">🌫️</span><span>${t.radar_how2}</span>
            </div>
            <div class="radar-welcome-howto-row">
              <span class="radar-welcome-howto-icon">✉</span><span>${t.radar_how3}</span>
            </div>
          </div>
        </div>
        <button data-action="nav" data-screen="screenDeposit" data-nav="nav-deposit" class="radar-welcome-cta-btn">${t.radar_first_btn}</button>
      </div>` : `
      <div class="radar-empty-block">
        <div class="radar-empty-icon">${_BRAND_MARK_HTML}</div>
        <div class="radar-empty-title">${t.radar_empty_title}</div>
        <div class="radar-empty-sub">${t.radar_empty_sub}</div>
        <div class="radar-empty-actions">
          <button data-action="loadNearbyGhosts" class="radar-empty-refresh-btn">↻ ${_currentLang === 'en' ? 'Refresh' : 'Actualiser'}</button>
          <button data-action="nav" data-screen="screenDeposit" data-nav="nav-deposit" class="radar-empty-deposit-btn">👻 ${_currentLang === 'en' ? 'Be first to haunt' : 'Hanter en premier'}</button>
        </div>
        ${_renderDistantGhostsTeaser()}
      </div>`;
    return;
  }
  if (wrap) wrap.classList.remove('is-welcome');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="radar-filter-empty">${t.radar_filter_empty}</div>`;
    return;
  }
  list.innerHTML = filtered.map(g => {
    // Trace coloré (cf. _traceMarkHTML) — même rendu que sur la Carte, pas
    // l'ancien _ghostEmojiHTML() qui n'était pas encore migré ici
    // (BUG-CARTE-PERSISTANT-ET-UNDEFINED.md, bug 2).
    const emoji = g.secret ? '🔮' : g.businessMode ? '🏪'
      : _traceMarkHTML(g, { size: 24, discovered: getDiscoveredIds().includes(g.id) });
    // Âge du fantôme
    const ageMs = g.createdAt ? Date.now() - g.createdAt.seconds * 1000 : 0;
    const ageDays = ageMs / 86400000;
    const isAncient = ageDays > 180;
    const isOld = ageDays > 30;
    const ageClass = isAncient ? ' ghost-age-ancient' : isOld ? ' ghost-age-old' : '';
    const ageBadge = isAncient ? `<span class="ghost-badge-archive">${t.ghost_badge_archive}</span>`
                   : isOld ? `<span class="ghost-badge-old">${t.ghost_badge_old}</span>` : '';
    // Résonances visuelles (étoiles)
    const resoCount = g.resonances || 0;
    const resoStars = resoCount > 0 ? '✦'.repeat(Math.min(resoCount, 5)) : '✦ 0';
    const resoClass = resoCount >= 5 ? ' reso-high' : resoCount >= 2 ? ' reso-mid' : '';
    const neverOpened = !g.openCount || g.openCount === 0;
    const virginBadge = neverOpened
      ? `<span class="ghost-badge-virgin">${t.ghost_badge_virgin}</span>`
      : '';
    // Hint dynamique selon état
    const hintText = neverOpened && ageDays > 30
      ? t.ghost_hint_never_old.replace('{n}', Math.floor(ageDays))
      : neverOpened
      ? t.ghost_hint_never
      : g.openCondition === 'night' ? t.ghost_hint_night
      : g.openCondition === 'hour' ? '⏰ ' + (g.openHour || '')
      : g.openCondition === 'after' ? t.ghost_hint_prereq
      : t.ghost_hint_default;
    // Surnom poétique
    const authorDisplay = g.anonymous ? getPoeticName(g.id) : escapeHTML(g.author || '');
    const _distClass = g.distance <= 80 ? 'dist-near' : g.distance <= 300 ? 'dist-mid' : 'dist-far';
    // Seuils de bordure distincts de _distClass ci-dessus — voir commentaire
    // dans style.css (.edist-border-*) : incohérence préexistante conservée.
    const _distBorderClass = g.distance <= 50 ? 'edist-border-near' : g.distance <= 200 ? 'edist-border-mid' : 'edist-border-far';
    const _tier = getGhostTier(g.id);
    const _tierAttr = _tier.name !== 'common' ? ` data-tier="${_tier.name}"` : '';
    const _tierBadge = getTierBadgeHTML(_tier);
    const _proxClass = getProximityClass(g.distance);
    const _proxAttr = _proxClass ? ` data-proximity="${_proxClass}"` : '';
    return `
    <div class="ghost-envelope${g.secret ? ' ghost-envelope-secret' : ''}${ageClass}"${_tierAttr}${_proxAttr} data-action="openGhost" data-id="${escapeHTML(g.id)}" role="button" tabindex="0" aria-label="Trace à ${escapeHTML(g.location || t.detail_location_unknown)}, ${formatDistance(g.distance)}">
      <div class="envelope-flap" aria-hidden="true"><div class="envelope-flap-inner"></div></div>
      <div class="envelope-body">
        <div class="envelope-emoji" aria-hidden="true">${emoji}</div>
        <div class="envelope-content">
          <div class="envelope-location">📍 ${escapeHTML(g.location || t.detail_location_unknown)}${g.secret ? ' <span class="secret-badge" aria-label="Secret">SECRET</span>' : ''}${_tierBadge}${ageBadge}${virginBadge}</div>
          <div class="envelope-hint">${hintText}</div>
        </div>
        <div class="envelope-meta">
          <div class="envelope-dist ${_distClass} ${_distBorderClass}">${formatDistance(g.distance)}</div>
          <div class="envelope-reso${resoClass}" aria-label="${resoCount} résonances">${resoStars}</div>
          ${g.openCount > 0 ? `<div class="envelope-views" aria-label="${g.openCount} vues">👁 ${g.openCount}</div>` : ''}
        </div>
      </div>
      <div class="envelope-footer">
        <div class="envelope-tag">${authorDisplay}</div>
        <div class="envelope-tag">⏳ ${escapeHTML(timeRemaining(g))}</div>
        <div class="envelope-tag">${timeAgo(g.createdAt)}</div>
      </div>
    </div>`;
  }).join('');
  _hydrateTraceMarks(list);
}

// Rayon de détection du radar, réglable par l'utilisateur (50/200/1000 m)
window._radarRadius = parseInt(localStorage.getItem('ghostub_radar_radius') || '200', 10);

function setRadarRadius(meters) {
  window._radarRadius = meters;
  localStorage.setItem('ghostub_radar_radius', String(meters));
  // Met à jour l'état visuel des boutons
  document.querySelectorAll('.radar-radius-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.r, 10) === meters);
  });
  // Ré-affiche les dots
  renderRadarDots();
  // Haptic feedback si dispo
  try { if (window.HapticsService?.tap) window.HapticsService.tap(); } catch(_){ console.warn('[ghostub:setRadarRadius:haptic]', _); }
}

// ⚠️ Doit rester identique à "sweep 4s" (.radar-sweep) et "ghostReveal 4s"
// (.ghost-dot-emoji) dans index.html. Le sweep exact de la maquette
// (ghostub-nocturne-precieux.html) a son pic à 0deg (0% du cycle angulaire),
// pas 17% comme l'ancien dégradé à 5 paliers — @keyframes ghostReveal a été
// recalée en conséquence (pic à 0%/100%). _radarPingLoop() s'en sert pour
// caler le bip sonore sur le passage réel du faisceau.
const RADAR_SWEEP_DURATION_S = 4;
const RADAR_SWEEP_PEAK_FRACTION = 0;

function renderRadarDots() {
  const radar = document.getElementById('radarDots');
  if (!radar) return;
  radar.innerHTML = '';
  radarPingTargets = [];

  const radius = window._radarRadius || 200;

  // Filtrer : uniquement les fantômes à portée du radar
  const inRange = nearbyGhosts.filter(g =>
    typeof g.distance === 'number' && g.distance <= radius && g.lat && g.lng
  );

  // Compteur visuel (ex. "3/12 à portée")
  const counter = document.getElementById('radarInRangeCount');
  if (counter) {
    counter.textContent = inRange.length > 0
      ? `${inRange.length}/${nearbyGhosts.length} à portée`
      : (nearbyGhosts.length > 0 ? 'Aucun à portée — rapproche-toi' : '');
  }

  if (inRange.length === 0) return;

  inRange.forEach((g) => {
    // Angle géographique réel basé sur le cap (bearing) entre l'utilisateur et le fantôme
    // Utilise les coords GPS pour un vrai radar directionnel
    const lat1 = userLat * Math.PI / 180;
    const lat2 = g.lat * Math.PI / 180;
    const deltaLng = (g.lng - userLng) * Math.PI / 180;
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    let bearing = Math.atan2(y, x); // 0 = Nord, π/2 = Est
    // On veut 0 = haut du radar = Nord, donc on soustrait π/2
    const angle = bearing - Math.PI / 2;

    // Distance radiale sur le radar : proportionnelle au rayon de détection
    // 15% minimum pour ne pas chevaucher le centre, 44% maximum pour rester dans le cercle
    const r = 15 + (g.distance / radius) * 29;
    const cx = 50 + r * Math.cos(angle);
    const cy = 50 + r * Math.sin(angle);

    const dot = document.createElement('div');
    // Halo de rareté (Lot G2) : lavande pour les secrets (mécanique dédiée,
    // déjà distincte via 🔮), doré pour rare/légendaire (cf. GHOST_TIERS) —
    // distinct du bleu commun par défaut du Trace. Les "uncommon" restent
    // neutres, seule la vraie rareté (rare/legendary) mérite le halo.
    let _tierDotClass = '';
    // Couleur EXACTE de la maquette (ghostub-nocturne-precieux.html) par
    // rareté — sert de `color` au Trace pour le drop-shadow(currentColor)
    // de .ghost-dot-emoji (cf. @keyframes ghostReveal). Portée en CSS
    // (.ghost-dot-secret/.ghost-dot-rare .ghost-dot-emoji, style.css) plutôt
    // qu'en style="" inline — CSP audit 4.6 — d'où _tierDotClass qui pilote
    // maintenant aussi cette couleur, pas seulement le halo.
    if (g.secret) {
      _tierDotClass = ' ghost-dot-secret';
    } else {
      const _tier = getGhostTier(g.id);
      if (_tier.name === 'rare' || _tier.name === 'legendary') { _tierDotClass = ' ghost-dot-rare'; }
    }
    dot.className = 'ghost-dot' + _tierDotClass;
    dot.style.left = cx + '%';
    dot.style.top = cy + '%';

    // Indicateur de type de média (Lot G-bis) : remplace l'info perdue avec
    // le retrait de la liste d'enveloppes sous le radar — priorité vidéo >
    // photo > voix, pas de badge si texte seul (déjà l'état par défaut).
    const _mediaIcon = g.videoUrl ? '🎥' : g.photoUrl ? '📷' : g.audioUrl ? '🎙' : null;
    const _mediaLabel = g.videoUrl ? (_currentLang === 'en' ? 'video' : 'vidéo')
      : g.photoUrl ? (_currentLang === 'en' ? 'photo' : 'photo')
      : g.audioUrl ? (_currentLang === 'en' ? 'voice message' : 'message vocal')
      : null;

    // Accessibilité : focusable + label
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `${escapeHTML(g.location || 'Fantôme')} — ${formatDistance(g.distance)}` + (_mediaLabel ? ` · ${_mediaLabel}` : ''));

    dot.onclick = () => openGhost(g.id);
    dot.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGhost(g.id); } };

    // Trace coloré par catégorie + fané par ancienneté (cf. FEATURE-TRACE-COLORE-FANAGE.md)
    // — plus d'icône de catégorie brute sur le radar, uniquement le Trace.
    // Les secrets gardent leur 🔮 dédié (mécanique de révélation distincte).
    // Taille ~10% du diamètre du radar (34px/300px maquette) — cf. .ghost-dot-emoji
    const emoji = g.secret ? '🔮' : _traceMarkHTML(g, { size: 38, discovered: getDiscoveredIds().includes(g.id) });
    const label = escapeHTML(g.location || (_currentLang === 'en' ? 'Ghost' : 'Fantôme'));

    // Synchronisation avec le sweep : pic d'animation calé sur l'angle du dot
    const sweepDuration = RADAR_SWEEP_DURATION_S;
    const angleNorm = ((angle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const delay = -(angleNorm / (2 * Math.PI)) * sweepDuration;

    dot.innerHTML = `
      <div class="ghost-dot-halo" aria-hidden="true"></div>
      <div class="ghost-dot-emoji" aria-hidden="true">${emoji}</div>
      <div class="ghost-dot-inner" aria-hidden="true"></div>
      <div class="ghost-dot-label" aria-hidden="true">${label} · ${formatDistance(g.distance)}</div>
    `;
    // animation-delay reste posé en JS (propriété DOM .style, pas un
    // style="" du markup — hors périmètre CSP, valeur continue par fantôme
    // impossible à réduire en classes discrètes).
    const _dotEmojiEl = dot.querySelector('.ghost-dot-emoji');
    if (_dotEmojiEl) _dotEmojiEl.style.animationDelay = delay.toFixed(2) + 's';
    _hydrateTraceMarks(dot);
    // FIX (bug pré-existant, hors Lot G-bis mais bloquant pour l'indicateur de
    // média) : appendChild() doit venir APRÈS dot.innerHTML= ci-dessus, sinon
    // innerHTML remplace tout le contenu et efface silencieusement les badges
    // — c'est pour ça que le badge 🏪 Commerce n'apparaissait jamais non plus.
    if (g.businessMode) {
      const bizBadge = document.createElement('div');
      bizBadge.textContent = '🏪';
      bizBadge.style.cssText = 'position:absolute;top:-8px;right:-8px;font-size:14px;filter:drop-shadow(0 0 4px rgba(var(--premium-rgb),.6));';
      dot.style.position = 'absolute';
      dot.appendChild(bizBadge);
    }
    if (_mediaIcon) {
      const mediaBadge = document.createElement('div');
      mediaBadge.textContent = _mediaIcon;
      mediaBadge.setAttribute('aria-hidden', 'true');
      mediaBadge.style.cssText = 'position:absolute;bottom:-6px;right:-6px;font-size:12px;filter:drop-shadow(0 0 4px rgba(0,0,0,.7));';
      dot.style.position = 'absolute';
      dot.appendChild(mediaBadge);
    }
    radar.appendChild(dot);

    // Cible de ping sonar : même horloge que le flash visuel du dot (delay
    // ci-dessus), pas les secrets (déjà leur propre chime à la détection).
    if (!g.secret) {
      const peakSec = ((RADAR_SWEEP_PEAK_FRACTION * sweepDuration - delay) % sweepDuration + sweepDuration) % sweepDuration;
      radarPingTargets.push({ id: g.id, peakSec });
    }
  });
}

// Expose setRadarRadius globalement pour les onclick inline
window.setRadarRadius = setRadarRadius;

// ── PING SONAR — calé sur le passage du faisceau radar ──────────────────
// Indépendant de loadNearbyGhosts()/du refresh : suit uniquement la rotation
// continue du faisceau (.radar-sweep, 4s linear infinite) et sonne, pour
// chaque fantôme affiché, exactement quand le faisceau croise son angle
// (radarPingTargets, recalculé à chaque renderRadarDots()). Redémarre à
// chaque entrée sur l'écran radar (cf. window.showScreen), s'arrête dès
// qu'on le quitte — pas de son en tâche de fond, pas de fuite d'intervalle.
let _radarPingIntervalId = null;
let _radarPingStartTime = 0;
let _radarPingLastPhase = 0;

function _startRadarPingLoop() {
  _stopRadarPingLoop();
  _radarPingStartTime = performance.now();
  _radarPingLastPhase = 0;
  _radarPingIntervalId = setInterval(() => {
    const elapsedSec = (performance.now() - _radarPingStartTime) / 1000;
    const phase = elapsedSec % RADAR_SWEEP_DURATION_S;
    const last = _radarPingLastPhase;
    for (const target of radarPingTargets) {
      const p = target.peakSec;
      // Détection de croisement entre deux échantillons — gère le passage
      // 0 -> 2π (fin de tour) comme un cas normal, pas un raté.
      const crossed = phase >= last ? (p > last && p <= phase) : (p > last || p <= phase);
      if (crossed) AudioService.playSonarPing();
    }
    _radarPingLastPhase = phase;
  }, 80);
}

function _stopRadarPingLoop() {
  if (_radarPingIntervalId) { clearInterval(_radarPingIntervalId); _radarPingIntervalId = null; }
}

let currentGhostIndex = 0;

function updateSwipeUI() {
  const total = nearbyGhosts.length;
  const counter = document.getElementById('swipeCounter');
  const prev = document.getElementById('swipePrev');
  const next = document.getElementById('swipeNext');
  if (!counter) return;
  if (total > 1) {
    counter.textContent = (currentGhostIndex + 1) + ' / ' + total;
    prev.classList.toggle('disabled', currentGhostIndex === 0);
    next.classList.toggle('disabled', currentGhostIndex === total - 1);
    prev.setAttribute('aria-disabled', currentGhostIndex === 0);
    next.setAttribute('aria-disabled', currentGhostIndex === total - 1);
  } else {
    counter.textContent = '';
    prev.classList.add('disabled');
    next.classList.add('disabled');
  }
}

window.swipeGhost = (dir) => {
  const newIndex = currentGhostIndex + dir;
  if (newIndex < 0 || newIndex >= nearbyGhosts.length) return;
  const scroll = document.querySelector('#screenDetail .scroll');
  scroll.classList.add(dir > 0 ? 'swipe-left' : 'swipe-right');
  setTimeout(() => {
    scroll.classList.remove('swipe-left','swipe-right');
    scroll.style.transform = dir > 0 ? 'translateX(60px)' : 'translateX(-60px)';
    scroll.style.opacity = '0';
    currentGhostIndex = newIndex;
    openGhost(nearbyGhosts[newIndex].id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scroll.style.transition = 'transform .25s cubic-bezier(.25,.46,.45,.94),opacity .2s';
        scroll.style.transform = '';
        scroll.style.opacity = '';
      });
    });
  }, 200);
};

(function() {
  let startX = 0, startY = 0, dragging = false;
  document.addEventListener('touchstart', e => {
    if (!document.getElementById('screenDetail').classList.contains('active')) return;
    // Ne pas naviguer entre fantomes pendant le grattage (un grattage horizontal
    // rapide faisait sauter au message suivant).
    if (window._scratchActive || (e.target && e.target.closest && e.target.closest('#scratchZone'))) { dragging = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!dragging || window._scratchActive) { dragging = false; return; }
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      swipeGhost(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

// Résout selectedGhost/currentGhostIndex pour l'id demandé (cache local
// nearbyGhosts, sinon fetch Firestore). Retourne false si le fantôme est
// introuvable ou inaccessible (l'UI d'erreur est déjà posée) — le caller
// doit alors sortir immédiatement d'openGhost.
async function _resolveGhostForOpen(id) {
  const idx = nearbyGhosts.findIndex(g => g.id === id);
  if (idx !== -1) currentGhostIndex = idx;
  selectedGhost = nearbyGhosts.find(g => g.id === id);
  // FIX: Ne PAS appeler addDiscovery ici — seulement quand l'enveloppe est RÉELLEMENT ouverte
  // (déplacé dans _doOpenEnvelope)
  WorldService.registerPresence(id, false).catch(() => {});

  if (!selectedGhost) {
    try {
      const docSnap = await getDoc(doc(db, COLL.GHOSTS, id));
      if (!docSnap.exists()) { showToast('info', t.detail_ghost_gone); return false; }
      selectedGhost = { id: docSnap.id, ...docSnap.data(), distance: 0 };
    } catch(e) {
      // Erreur réseau/permission distincte d'un fantôme réellement supprimé —
      // message générique plutôt que d'affirmer à tort qu'il n'existe plus.
      console.warn('[ghostub:openGhost]', e);
      showToast('error', t.misc_error_generic);
      return false;
    }
  }
  return true;
}

function _renderGhostDetailHeader() {
  document.getElementById('detailLocation').textContent = '📍 ' + escapeHTML(selectedGhost.location || t.detail_location_unknown);
  // Icône de catégorie (Sceau) visible dans le détail — seul autre endroit
  // avec l'écran de dépôt où elle apparaît (cf. FEATURE-TRACE-COLORE-FANAGE.md).
  const sealedEl = document.getElementById('sealedEmoji');
  const _sv = selectedGhost.secret ? '🔮'
    : selectedGhost.businessMode ? '🏪'
    : null;
  if (_sv) { sealedEl.textContent = _sv; }
  else if (selectedGhost.emoji && selectedGhost.emoji !== '👻') {
    sealedEl.innerHTML = `<span class="sealed-emoji-wrap">${_categoryIconHTML(selectedGhost.emoji, { size: 32 })}</span>`;
  }
  else { sealedEl.innerHTML = _BRAND_MARK_HTML; }
  const readCountEl = document.getElementById('detailReadCount');
  if (readCountEl) readCountEl.style.display = 'none';
}

// Calcule distance/propriétaire/verrouillage et pose les libellés qui en
// dépendent (sealedHint, detailDistance). Retourne { isOwner, isLocked }.
function _computeGhostDetailAccess() {
  // FIX: Guard contre lat/lng manquants
  const ghostDist = (selectedGhost.distance != null) ? selectedGhost.distance :
    (selectedGhost.lat && selectedGhost.lng && userLat ?
      distanceMeters(userLat, userLng, selectedGhost.lat, selectedGhost.lng) : 0);

  const _authorLabel = selectedGhost.anonymous
    ? '👻 ' + t.detail_anonymous
    : escapeHTML(selectedGhost.author || '');
  document.getElementById('sealedHint').textContent = _authorLabel + ' · ' + formatDistance(ghostDist);
  document.getElementById('detailDistance').textContent = formatDistance(ghostDist) + ' ' + t.detail_from_you;

  const isOwner = currentUser && selectedGhost && (
    selectedGhost.authorUid === currentUser.uid ||
    selectedGhost.authorEmail === currentUser.email  // fallback
  );
  // FIX: isLocked vérifie la distance calculée (ghostDist)
  const isLocked = selectedGhost.secret && ghostDist > 3 && !isOwner;
  return { isOwner, isLocked };
}

// ── Ghost dédié : vérifier si l'utilisateur est le destinataire ──
// Retourne false si bloqué (overlay déjà affiché) — le caller doit sortir.
function _checkDedicatedGhostAccess(isOwner) {
  if (selectedGhost.dedicatedTo && !isOwner) {
    const uid = currentUser?.uid || '';
    const email = currentUser?.email || '';
    const target = selectedGhost.dedicatedTo.trim();
    const isRecipient = target === uid || target === email || target === '';
    if (!isRecipient) {
      showScreen('screenDetail');
      setNav('nav-radar');
      showBlockedOverlay({
        ok: false,
        titleKey: 'blocked_dedicated_title',
        subKey: 'blocked_dedicated_sub',
        title: '💌 Message personnel',
        sub: 'Ce ghost a été laissé pour quelqu’un d’autre.',
        showTimer: false
      });
      return false;
    }
  }
  return true;
}

// ── Vérifier la condition d'ouverture (sauf pour le propriétaire, SAUF capsule temporelle) ──
// Retourne false si bloqué (overlay déjà affiché) — le caller doit sortir.
function _checkGhostOpenCondition(isOwner) {
  resetBlockedOverlay();
  // La date future doit s'appliquer même au créateur : sinon l'effet "lettre au futur" n'a plus de sens.
  const _forceCondCheck = selectedGhost.openCondition === 'future';
  if (!isOwner || _forceCondCheck) {
    const condCheck = isConditionMet(selectedGhost);
    if (!condCheck.ok) {
      showScreen('screenDetail');
      setNav('nav-radar');
      document.getElementById('detailLocation').textContent = '📍 ' + escapeHTML(selectedGhost.location || t.detail_location_unknown);
      showBlockedOverlay(condCheck);
      return false;
    }
  }
  return true;
}

function _renderLockedGhostDetail() {
  document.getElementById('detailMessage').textContent = t.ghost_secret_locked;
  document.getElementById('detailMessage').style.color = 'rgba(168,100,255,0.6)';
  document.getElementById('detailAudio').innerHTML = '';
  document.getElementById('detailPhoto').innerHTML = '';
  document.getElementById('resonanceBtn').style.display = 'none';
  document.getElementById('secretBtn').style.display = 'none';
  document.querySelector('#screenDetail .btn-secondary').style.display = 'none';
  const msgRBtnLocked = document.getElementById('msgReportBtn');
  if (msgRBtnLocked) msgRBtnLocked.style.display = 'none';
}

function _renderGhostDetailMessage(isOwner) {
  document.getElementById('detailMessage').style.color = '';
  document.getElementById('resonanceBtn').style.display = '';
  document.querySelector('#screenDetail .btn-secondary').style.display = '';
  document.getElementById('detailMessage').innerHTML = '&ldquo;' + escapeHTML(selectedGhost.message).replace(/&#39;/g, "'") + '&rdquo;';
  // Afficher le bouton ⚑ sur le message seulement si ce n'est pas son propre fantôme
  const msgReportBtn = document.getElementById('msgReportBtn');
  if (msgReportBtn) msgReportBtn.style.display = isOwner ? 'none' : 'flex';
  document.getElementById('detailAuthor').textContent = selectedGhost.anonymous ? getPoeticName(selectedGhost.id) : '🌫️ ' + escapeHTML(selectedGhost.author || '');

  // ── Mode Commerce : afficher le code promo ──
  const existingPromo = document.getElementById('detailPromoBlock');
  if (existingPromo) existingPromo.remove();
  if (selectedGhost.businessMode && selectedGhost.promoCode) {
    const promoBlock = document.createElement('div');
    promoBlock.id = 'detailPromoBlock';
    promoBlock.style.cssText = 'margin:16px 0 0;background:rgba(var(--premium-rgb),.08);border:1px solid rgba(var(--premium-rgb),.35);border-radius:14px;padding:14px 16px;text-align:center;';
    promoBlock.innerHTML =
      '<div class="promo-code-label">&#x1F3EA; Offre exclusive</div>' +
      '<div class="promo-code-value">' + escapeHTML(selectedGhost.promoCode) + '</div>' +
      '<div class="promo-code-hint">Présentez ce message en caisse pour en bénéficier</div>';
    document.getElementById('detailMessage').after(promoBlock);
  }
}

function _renderGhostDetailMeta() {
  document.getElementById('detailTime').textContent = '🕰 ' + timeAgo(selectedGhost.createdAt);
  document.getElementById('detailDuration').textContent = '⏳ ' + timeRemaining(selectedGhost);
  document.getElementById('detailRadius').textContent = '📡 ' + escapeHTML(selectedGhost.radius || '10m');

  // ── Mode Commerce : masquer Partager et la réaction courte ──
  const isBizGhost = !!selectedGhost.businessMode;
  const shareBtn2 = document.getElementById('ghostShareBtn');
  const resoBtn2  = document.getElementById('resonanceBtn');
  const microRow2 = document.querySelector('.micro-reply-row');
  if (shareBtn2) shareBtn2.style.display = isBizGhost ? 'none' : '';
  if (resoBtn2)  resoBtn2.style.display  = isBizGhost ? 'none' : '';
  if (microRow2) microRow2.style.display = isBizGhost ? 'none' : '';

  const chainDiv = document.getElementById('detailChain');
  if (selectedGhost.chainHint || selectedGhost.chainLat) {
    chainDiv.style.display = 'block';
    chainDiv.innerHTML = `
      <div class="detail-chain-box">
        <div class="detail-chain-label">🔗 La piste continue…</div>
        ${selectedGhost.chainHint ? `<div class="detail-chain-hint">"${escapeHTML(selectedGhost.chainHint)}"</div>` : ''}
        ${selectedGhost.chainLat ? `<button data-action="followChain" class="detail-chain-follow-btn">🗺 Suivre la piste →</button>` : ''}
      </div>`;
  } else {
    chainDiv.style.display = 'none';
  }
}

function _renderGhostResonanceButtonState() {
  const alreadyToday = hasResonatedToday();
  const resoBtn = document.getElementById('resonanceBtn');
  if (alreadyToday) {
    resoBtn.classList.add('resonated');
    resoBtn.textContent = t.detail_reso_used;
    resoBtn.style.borderColor = 'rgba(var(--ghost-blue-rgb),.2)';
    resoBtn.style.color = 'rgba(var(--ghost-blue-rgb),.4)';
    resoBtn.style.cursor = 'default';
  } else {
    resoBtn.classList.remove('resonated');
    resoBtn.style.borderColor = '';
    resoBtn.style.color = '';
    resoBtn.style.cursor = '';
    document.getElementById('resonanceCount').textContent = t.detail_reso_btn.replace('{n}', selectedGhost.resonances || 0);
  }
}

function _renderGhostDetailMedia() {
  // Passer en secret désactivé (Lot P) — plus aucun nouveau fantôme secret,
  // même en convertissant un fantôme existant après coup.
  document.getElementById('secretBtn').style.display = 'none';

  const audioEl = document.getElementById('detailAudio');
  if (selectedGhost.audioUrl) {
    audioEl.innerHTML = `
      <div class="detail-media-block">
        <div class="detail-media-label">🎙 Message vocal</div>
        <audio controls src="${escapeHTML(selectedGhost.audioUrl)}" class="detail-audio-el" aria-label="Message vocal du fantôme"></audio>
      </div>`;
  } else { audioEl.innerHTML = ''; }

  const photoEl = document.getElementById('detailPhoto');
  if (selectedGhost.videoUrl) {
    photoEl.innerHTML = `
      <div class="detail-media-block-rel">
        <div class="detail-media-label">🎥 Vidéo</div>
        <div class="detail-video-wrap">
          <video controls playsinline src="${escapeHTML(selectedGhost.videoUrl)}" class="detail-video-el" aria-label="Vidéo du fantôme"></video>
          <button data-action="openReportModal" aria-label="Signaler cette vidéo" title="Signaler cette vidéo" class="detail-media-report-btn">⚑ Signaler</button>
        </div>
      </div>`;
  } else if (selectedGhost.photoUrl) {
    photoEl.innerHTML = `
      <div class="detail-media-block-rel">
        <div class="detail-media-label">📷 Photo</div>
        <div class="detail-photo-wrap">
          <img src="${escapeHTML(selectedGhost.photoUrl)}" alt="Photo associée à ce fantôme" class="detail-photo-img" loading="lazy">
          <button data-action="openReportModal" aria-label="Signaler cette photo comme inappropriée" title="Signaler cette photo" class="detail-media-report-btn detail-media-report-btn--hover">⚑ Signaler</button>
        </div>
      </div>`;
  } else { photoEl.innerHTML = ''; }
}

async function _loadGhostReplies(id) {
  const repliesSnap = await getDocs(query(
    collection(db, COLL.REPLIES),
    where('ghostId', '==', id),
    orderBy('createdAt', 'desc')
  ));
  const repliesList = document.getElementById('repliesList');
  repliesList.innerHTML = '';
  if (!repliesSnap.empty) {
    repliesSnap.forEach(d => {
      const r = d.data();
      // Tronquer les anciennes réponses longues (avant le passage aux réactions courtes)
      // pour qu'elles restent lisibles sous forme de capsule.
      let txt = (r.message || '').trim();
      if (txt.length > 28) txt = txt.slice(0, 26).trim() + '…';
      repliesList.innerHTML += `<span class="micro-reply-pill">✦ ${escapeHTML(txt)}</span>`;
    });
  }
}

window.openGhost = async (id) => {
  if (_isGuestUser()) { _promptSignUp('guest_signup_open'); return; }
  if (!(await _resolveGhostForOpen(id))) return;

  _renderGhostDetailHeader();
  const { isOwner, isLocked } = _computeGhostDetailAccess();

  if (!_checkDedicatedGhostAccess(isOwner)) return;
  if (!_checkGhostOpenCondition(isOwner)) return;

  if (isLocked) {
    _renderLockedGhostDetail();
  } else {
    _renderGhostDetailMessage(isOwner);
    _renderGhostDetailMeta();
    _renderGhostResonanceButtonState();
    _renderGhostDetailMedia();
  }

  await _loadGhostReplies(id);

  updateSwipeUI();
  updateReportBtn(id);
  updateFavoriteBtn();
  showScreen('screenDetail');
  setNav('');
};

function getDailyResoKey() {
  const d = new Date();
  const uid = currentUser ? currentUser.uid : 'anon';
  return `daily_reso_${uid}_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function hasResonatedToday() { return !!localStorage.getItem(getDailyResoKey()); }

// ── LIMITE OUVERTURES JOURNALIÈRES (Firestore) ───────────
const DAILY_OPEN_LIMIT = 3;

function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Vérification + incrémentation FIABLE de la limite, via Cloud Function ──
// (le client ne peut plus écrire directement dailyOpens — voir firestore.rules)
async function consumeOpenQuota() {
  if (!currentUser) {
    // Pas de session auth du tout (cas limite) : on ne peut rien vérifier côté serveur
    _incrementLocal();
    return { allowed: getDailyOpenCountLocal() <= DAILY_OPEN_LIMIT, remaining: Math.max(0, DAILY_OPEN_LIMIT - getDailyOpenCountLocal()) };
  }
  // Un échec (réseau, timeout, Cloud Function indisponible) ne doit JAMAIS se
  // traduire par une ouverture gratuite illimitée (cf. LOT-AUDIT-4) : on
  // retente une fois après une courte pause pour absorber les micro-coupures
  // réseau (fréquent en usage mobile/extérieur), puis on bloque (fail-closed)
  // si l'échec persiste, avec un message clair plutôt qu'un blocage silencieux.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await _checkAndConsumeOpenCallable();
      return res.data; // { allowed, remaining }
    } catch (e) {
      console.error(`checkAndConsumeOpen error (tentative ${attempt}/2)`, e);
      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      Analytics.track('quota_check_failed', { code: e.code || 'unknown' });
      return { allowed: false, remaining: null, networkError: true };
    }
  }
}

async function remainingOpensToday() {
  if (isPremium) return Infinity;
  if (!currentUser) return Math.max(0, DAILY_OPEN_LIMIT - getDailyOpenCountLocal());
  try {
    const ref = doc(db, 'userStats', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().isDevAccount === true) return Infinity; // compte dev (flag Firestore, pas d'UID en dur côté client)
    const count = snap.exists() ? (snap.data().dailyOpens?.[_todayKey()] || 0) : 0;
    return Math.max(0, DAILY_OPEN_LIMIT - count);
  } catch(e) {
    return Math.max(0, DAILY_OPEN_LIMIT - getDailyOpenCountLocal());
  }
}

// Helpers localStorage (cache local rapide + aperçu avant vérif serveur)
function _getDailyOpenLocalKey() {
  const uid = currentUser ? currentUser.uid : 'anon';
  return `daily_opens_${uid}_${_todayKey()}`;
}
function getDailyOpenCountLocal() { return parseInt(localStorage.getItem(_getDailyOpenLocalKey()) || '0'); }
function _incrementLocal() {
  const key = _getDailyOpenLocalKey();
  localStorage.setItem(key, getDailyOpenCountLocal() + 1);
}

// ── DÉCOUVERTES (Firestore + localStorage) ───────────────
function getDiscoveryKey() { return currentUser ? 'discoveries_' + currentUser.uid : 'discoveries_anon'; }

function getDiscoveredIds() {
  try { return JSON.parse(localStorage.getItem(getDiscoveryKey()) || '[]'); } catch(e) { return []; }
}

function addDiscovery(ghostId) {
  const ids = getDiscoveredIds();
  if (ids.includes(ghostId)) return false;
  ids.push(ghostId);
  // Sauvegarder localement
  localStorage.setItem(getDiscoveryKey(), JSON.stringify(ids));
  // Syncer dans Firestore (sans bloquer)
  if (currentUser) {
    setDoc(doc(db, 'userStats', currentUser.uid),
      { discoveries: ids },
      { merge: true }
    ).catch(() => {});
  }
  return true;
}

function getDiscoveryCount() { return getDiscoveredIds().length; }

// Charger les découvertes depuis Firestore au login et les fusionner
async function syncDiscoveriesFromFirestore() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'userStats', currentUser.uid));
    if (snap.exists() && snap.data().discoveries) {
      const remote = snap.data().discoveries;
      const local = getDiscoveredIds();
      const merged = [...new Set([...local, ...remote])];
      localStorage.setItem(getDiscoveryKey(), JSON.stringify(merged));
    }
  } catch(e) { console.warn('[ghostub:syncDiscoveriesFromFirestore]', e); }
}

function markResonatedToday(ghostId) { localStorage.setItem(getDailyResoKey(), ghostId); }

function fireResonanceParticles(btn) {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wave = document.createElement('div');
  wave.className = 'reso-shockwave';
  wave.style.left = cx + 'px';
  wave.style.top = cy + 'px';
  wave.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wave);
  setTimeout(() => wave.remove(), 700);
  const symbols = ['✦','✦','✦','✦','✧','·','👻','✦'];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'reso-particle';
    p.setAttribute('aria-hidden', 'true');
    const angle = (i / count) * 2 * Math.PI + (Math.random() - .5) * .4;
    const dist = 40 + Math.random() * 70;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist - 20;
    const size = 8 + Math.random() * 10;
    const dur = (0.5 + Math.random() * 0.5).toFixed(2) + 's';
    const delay = (Math.random() * 0.15).toFixed(2) + 's';
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const alpha = 0.5 + Math.random() * 0.5;
    p.style.cssText = ['left:'+cx+'px','top:'+cy+'px','--px:'+px.toFixed(0)+'px','--py:'+py.toFixed(0)+'px','--dur:'+dur,'animation-delay:'+delay,'font-size:'+size+'px','color:rgba(var(--ghost-blue-rgb),'+alpha+')','filter:drop-shadow(0 0 4px rgba(var(--ghost-blue-rgb),.6))','line-height:1'].join(';');
    p.textContent = sym;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
  if (navigator.vibrate) navigator.vibrate([15, 10, 30]);
  btn.classList.add('firing');
  setTimeout(() => btn.classList.remove('firing'), 500);
}


// ── GHOST WHISPER — écouter les résonances en temps réel ──
let _whisperUnsub = null;
function _startWhisperListener() {
  if (!currentUser) return;
  if (_whisperUnsub) _whisperUnsub();
  let _firstSnapshot = true;
  _whisperUnsub = onSnapshot(
    doc(db, COLL.WHISPERS, currentUser.uid),
    (snap) => {
      if (_firstSnapshot) { _firstSnapshot = false; return; } // ignorer l'état initial
      if (!snap.exists()) return;
      const data = snap.data();
      // Vibration mystérieuse + son de chuchotement
      HapticsService.whisper();
      AudioService.playWhisper();
      // Toast discret avec l'emoji du ghost
      const emoji = data.ghostEmoji || '👻';
      const loc = data.ghostLocation || '';
      const msg = t.whisper_vibration || (
        _currentLang === 'en'
          ? emoji + ' A soul resonated with your ghost'
          : emoji + ' Une âme a résonné sur ton fantôme'
      );
      showToast('success', msg + (loc ? ' · ' + loc : ''), 3500);
    },
    () => {} // ignorer les erreurs silencieusement
  );
}
// v105 : helper de cleanup exposé pour le logout
window._stopWhisperListener = () => {
  if (_whisperUnsub) { try { _whisperUnsub(); } catch(_){ console.warn('[ghostub:_stopWhisperListener]', _); } _whisperUnsub = null; }
};

window.resonate = async () => {
  const btn = document.getElementById('resonanceBtn');
  if (btn.classList.contains('resonated') || btn.disabled || !selectedGhost) return;
  if (hasResonatedToday()) {
    btn.style.borderColor = 'rgba(255,180,50,.4)';
    btn.style.color = 'rgba(var(--premium-rgb),.8)';
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    const h = Math.floor(msUntilMidnight / 3600000);
    const m = Math.floor((msUntilMidnight % 3600000) / 60000);
    btn.textContent = t.detail_reso_wait.replace('{h}', h).replace('{m}', m < 10 ? '0' + m : m);
    setTimeout(() => {
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.textContent = '✦ Résonner · ' + (selectedGhost.resonances || 0) + ' résonances';
    }, 3000);
    return;
  }
  // Capturer les champs nécessaires avant l'await : selectedGhost peut changer
  // pendant l'attente réseau si l'utilisateur navigue vers un autre fantôme.
  const ghostId = selectedGhost.id;
  const ghostAuthorUid = selectedGhost.authorUid;
  const ghostEmoji = selectedGhost.emoji;
  const ghostLocation = selectedGhost.location;

  // Verrou synchrone anti double-tap pendant l'écriture réseau.
  btn.disabled = true;
  try {
    await updateDoc(doc(db, COLL.GHOSTS, ghostId), { resonances: increment(1) });
  } catch (e) {
    console.warn('[ghostub:resonate]', e);
    btn.disabled = false;
    showToast('error', t.misc_error_generic || 'Erreur — réessaie plus tard.');
    return; // ni markResonatedToday() ni état "résonné" : l'utilisateur peut réessayer
  }

  // Écriture confirmée : on applique maintenant le verrou quotidien + l'état visuel/sonore.
  fireResonanceParticles(btn);
  AudioService.playResonance();
  HapticsService.resonance();
  btn.classList.add('resonated');
  btn.textContent = t.detail_reso_sent;
  btn.disabled = false;
  markResonatedToday(ghostId);
  // Compteur dénormalisé totalResonances sur l'auteur
  if (ghostAuthorUid) {
    setDoc(doc(db, COLL.USERS, ghostAuthorUid), { totalResonances: increment(1) }, { merge: true })
      .catch(e => console.warn('totalResonances increment:', e));
    // ── GHOST WHISPER — vibration mystérieuse pour l'auteur ──
    if (ghostAuthorUid !== currentUser?.uid) {
      setDoc(doc(db, COLL.WHISPERS, ghostAuthorUid), {
        lastWhisper: serverTimestamp(),
        ghostId: ghostId,
        ghostEmoji: ghostEmoji || '👻',
        ghostLocation: ghostLocation || '',
        count: increment(1)
      }, { merge: true }).catch(() => {});
    }
  }
  Analytics.track('resonate');
};

window.setChainMarker = () => {
  if (!userLat) { alert(t.toast_gps_req); return; }
  const preview = document.getElementById('chainMapPreview');
  preview.style.display = 'block';
  preview.innerHTML = '<div id="chainMiniMap" class="chain-minimap"></div>';
  const initChainMap = () => {
    const cmap = L.map('chainMiniMap', { zoomControl: false, attributionControl: false }).setView([userLat, userLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '© OSM France' }).addTo(cmap);
    L.marker([userLat, userLng], { icon: L.divIcon({ html: '<div class="chain-user-pin">📍</div>', iconSize:[20,20], iconAnchor:[10,10], className:'' }) }).addTo(cmap);
    let nextMarker = null;
    cmap.on('click', e => {
      if (nextMarker) cmap.removeLayer(nextMarker);
      nextMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: L.divIcon({ html: '<div class="chain-next-marker">🔗</div>', iconSize:[24,24], iconAnchor:[12,12], className:'' }) }).addTo(cmap);
      window._chainNextCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      document.getElementById('chainMapLabel').textContent = '✓ Point placé — retap pour déplacer';
    });
    setTimeout(() => cmap.invalidateSize(), 100);
  };
  if (window.L) { initChainMap(); } else {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = initChainMap;
    document.head.appendChild(s);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }
};

window.followChain = () => {
  if (!selectedGhost || !selectedGhost.chainLat) return;
  showScreen('screenMap');
  setNav('nav-map');
  setTimeout(() => {
    if (window.map) {
      window.map.setView([selectedGhost.chainLat, selectedGhost.chainLng], 18);
      L.marker([selectedGhost.chainLat, selectedGhost.chainLng], { icon: L.divIcon({ html: '<div class="chain-existing-marker">🔗</div>', iconSize:[32,32], iconAnchor:[16,32], className:'' }) }).addTo(window.map);
    }
  }, 800);
};

function _readDepositFormInputs() {
  const location = document.getElementById('depositLocation').value.trim();
  const rawEmoji  = document.getElementById('depositEmoji').value || '👻';
  // FIX: Limiter l'emoji à 2 caractères max pour éviter injection de HTML
  const emoji = [...rawEmoji].slice(0, 2).join('');
  const duration = document.querySelector('.dur-btn.active:not([data-maxopen])')?.textContent || t.dep_dur_7d;
  const maxOpenCount = parseInt(document.querySelector('.dur-btn.active[data-maxopen]')?.dataset.maxopen || '0');
  const radius   = document.querySelector('.radius-btn.active')?.textContent || '10m';
  // Pseudo par défaut, anonymat via le lien discret (Lot Q) — remplace
  // l'ancien dropdown Identité et son bug d'indexation (Lot O/P).
  const anon     = document.getElementById('anonToggleLink')?.classList.contains('active') || false;
  const err      = document.getElementById('depositError');
  return { location, emoji, duration, maxOpenCount, radius, anon, err };
}

// Construit le message du fantôme selon le mode (normal / commerce) et
// applique ses propres validations. Retourne `null` si une validation a
// échoué (l'UI d'erreur — toast/bordure/focus — est déjà posée par cette
// fonction, il faut alors sortir immédiatement de depositGhost), sinon
// retourne le message construit (potentiellement vide en mode normal — la
// validation "message vide" générale reste dans depositGhost).
//
// Le message dépend du mode : Commerce le reconstruit depuis titre/description/
// code (le champ #depositMsg normal est masqué dans ce mode, cf toggleBusinessMode) ;
// ces validations vivaient avant dans l'ancien wizardNext(1), disparu avec la
// fusion en une seule page (Lot H) — reportées ici pour ne pas les perdre.
function _buildDepositMessage() {
  if (_depositMode === 'business') {
    const bizTitle = document.getElementById('bizTitle').value.trim();
    if (!bizTitle) {
      const el = document.getElementById('bizTitle');
      el.style.borderColor = 'rgba(255,100,100,.5)';
      setTimeout(() => el.style.borderColor = '', 1500);
      el.focus();
      showToast('warning', t.dep_biz_title_err);
      return null;
    }
    const bizType = document.querySelector('#bizTypeSelector .type-btn.active')?.dataset.val || 'Offre';
    const bizDesc = document.getElementById('bizDesc').value.trim();
    const promoCodeVal = document.getElementById('promoCode').value.trim();
    let message = `🏪 ${bizType} : ${bizTitle}`;
    if (bizDesc) message += `\n${bizDesc}`;
    if (promoCodeVal) message += `\nCode : ${promoCodeVal}`;
    return message;
  } else {
    const message = document.getElementById('depositMsg').value.trim();
    // Filtre anti-pub pour les non-premium (Mode Commerce Premium requis pour les offres)
    if (!isPremium && message) {
      const spamWords = ['promo', 'soldes', 'remise', 'réduction', 'reduction', '% de', '% sur', 'gratuit', 'offre spéciale', 'offre speciale', 'achetez', 'commandez', 'livraison', 'prix', 'pas cher', 'discount', 'coupon', 'code promo'];
      const msgLower = message.toLowerCase();
      if (spamWords.some(w => msgLower.includes(w))) {
        showToast('warning', '🏪 Pour les messages commerciaux, utilisez le Mode Commerce Premium.', 4000);
        const msgEl = document.getElementById('depositMsg');
        msgEl.style.borderColor = 'rgba(var(--premium-rgb),.5)';
        setTimeout(() => msgEl.style.borderColor = '', 2000);
        return null;
      }
    }
    return message;
  }
}

// Vérification Premium serveur avant opération critique + cooldown (0 pour
// Premium, 15min pour Free). Retourne false si le dépôt est refusé (l'erreur
// est déjà posée dans `err`).
async function _verifyDepositAllowed(err) {
  if (isPremium) await _verifyPremiumServer();
  if (!isPremium) {
    const cooldownCheck = await WorldService.checkDepositCooldown(currentUser.uid, isExpired);
    if (!cooldownCheck.ok) { err.textContent = cooldownCheck.reason; return false; }
  }
  return true;
}

// Upload isolé dans son propre try/catch : en cas d'échec (y compris timeout),
// on ne doit JAMAIS créer le fantôme sans son média, et l'UI doit toujours
// se réinitialiser (bouton réactivé, spinner CSS retiré via setLoading).
// Retourne null si l'upload échoue (l'UI d'erreur est déjà posée).
async function _uploadDepositMedia(depositBtn, err, hasMedia) {
  setLoading(depositBtn, true);
  depositBtn.textContent = hasMedia ? '⬆ Upload…' : '';
  try {
    return await uploadMedia(currentUser.uid + '_' + Date.now());
  } catch (e) {
    console.warn('uploadMedia error:', e);
    setLoading(depositBtn, false, t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme');
    err.textContent = t.dep_upload_failed;
    showToast('error', t.dep_upload_failed, 5000);
    return null;
  }
}

// ── Dépôt via la Cloud Function createGhostSecure (audit 4.3) ───────
// Le document est désormais créé côté serveur (admin SDK) plutôt que
// par écriture directe du SDK client : c'est ce qui permet d'appliquer
// enfin DEPOSIT.MAX_ACTIVE (5 fantômes actifs max) de façon fiable —
// un comptage agrégé n'est pas possible dans firestore.rules seules.
// ghostCount et lastGhostCreatedAt sont mis à jour dans la même
// transaction côté fonction ; plus besoin de les écrire séparément ici.
function _buildGhostDepositPayload(uploadResult, input) {
  const { message, location, emoji, duration, radius, maxOpenCount, anon } = input;
  const {
    audioUrl, audioPublicId, audioResourceType,
    photoUrl, photoPublicId, photoResourceType,
    videoUrl, videoPublicId, videoResourceType,
    attachments,
  } = uploadResult;
  const chainHint = isPremium ? document.getElementById('chainHint').value.trim() : null;
  const chainNext = isPremium ? (window._chainNextCoords || null) : null;
  const openCondition = getSelectedCond();
  const openHour = openCondition === 'hour' ? document.getElementById('condHourInput').value : null;
  const openDate = openCondition === 'future' ? document.getElementById('condFutureInput').value : null;
  return {
    message, location: location || 'Lieu sans nom', emoji, duration, radius, maxOpenCount: maxOpenCount || 0,
    anonymous: anon,
    dedicatedTo: (isPremium && document.getElementById('dedicatedUidInput')?.value.trim()) || null,
    audioUrl: audioUrl || null, photoUrl: photoUrl || null, videoUrl: videoUrl || null,
    audioPublicId: audioPublicId || null, audioResourceType: audioResourceType || null,
    photoPublicId: photoPublicId || null, photoResourceType: photoResourceType || null,
    videoPublicId: videoPublicId || null, videoResourceType: videoResourceType || null,
    attachments: (isPremium && Array.isArray(attachments) && attachments.length > 0) ? attachments : null,
    chainHint: (isPremium && chainHint) || null,
    chainLat: chainNext ? chainNext.lat : null,
    chainLng: chainNext ? chainNext.lng : null,
    openCondition: openCondition || 'always',
    openHour: openHour || null,
    openDate: openDate || null,
    businessMode: (isPremium && _depositMode === 'business') || false,
    promoCode: (isPremium && _depositMode === 'business') ? (document.getElementById('promoCode')?.value.trim() || null) : null,
    author: currentUser.displayName || currentUser.email,
    lat: userLat, lng: userLng,
  };
}

// Retourne l'id du fantôme créé, ou null si le serveur a refusé (l'erreur
// est déjà posée dans `err`).
async function _submitGhostDeposit(ghostData, depositBtn, err) {
  try {
    const res = await _createGhostSecureCallable(ghostData);
    return res.data.ghostId;
  } catch (e) {
    console.warn('[ghostub:createGhostSecure]', e);
    setLoading(depositBtn, false, t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme');
    // resource-exhausted couvre à la fois le cooldown et le plafond de 5
    // fantômes actifs — le message précis vient du serveur (e.message),
    // les autres cas retombent sur un message générique traduit.
    err.textContent = (e.code === 'functions/resource-exhausted' && e.message)
      ? e.message
      : (e.code === 'functions/permission-denied')
        ? t.dep_err_denied
        : t.dep_err_generic;
    return null;
  }
}

// Déposer un fantôme compte aussi comme une action significative pour le streak.
// Réinitialise aussi le formulaire et l'état du mode dépôt pour le prochain dépôt.
function _resetDepositStateAfterSuccess(depositBtn) {
  const _suDep = _updateStreak();
  _renderStreak();
  if (_suDep.freezeJustUsed) showToast('info', t.streak_freeze_used);
  document.getElementById('depositMsg').value = '';
  document.getElementById('depositLocation').value = '';
  document.getElementById('chainHint').value = '';
  const promoEl = document.getElementById('promoCode');
  if (promoEl) promoEl.value = '';
  const bizExtra = document.getElementById('businessExtra');
  if (bizExtra) bizExtra.style.display = 'none';
  // v105 : reset l'état du mode dépôt après succès
  _depositMode = 'normal';
  window._depositMode = _depositMode;
  const bizIcon = document.getElementById('businessToggleIcon');
  if (bizIcon) bizIcon.textContent = '○';
  const bizBtn = document.getElementById('businessToggleBtn');
  if (bizBtn) bizBtn.style.borderColor = 'rgba(var(--premium-rgb),.2)';
  document.getElementById('chainMapLabel').textContent = 'Placer le prochain point sur la carte';
  document.getElementById('chainMapPreview').style.display = 'none';
  window._chainNextCoords = null;
  setLoading(depositBtn, false, t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme');
  clearAudio(); clearPhoto(); clearVideo(); clearAttachments();
  // Replier le menu média et le lien anonyme (Lot Q)
  _resetAnonToggle();
  ['step3VocalWrap','step3PhotoWrap','step3VideoWrap','step3AttachmentsWrap'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  if (typeof window.toggleMediaMenu === 'function') window.toggleMediaMenu(false);
}

function _showDepositSuccessScreen(ghostId) {
  document.getElementById('depositSuccess').classList.add('show');
  _maybeShowSuccessNotifPrompt();
  // Ghost dédié sans UID : afficher le lien de partage
  if (isPremium && !document.getElementById('dedicatedUidInput')?.value.trim()) {
    const _dedEl = document.getElementById('successSubText');
    if (_dedEl && ghostId) {
      const _link = 'https://pimpimshop33-dotcom.github.io/ghostub/?ghost=' + ghostId + '&dedicated=1&ref=' + (currentUser.uid.slice(0,8));
      window._lastDedicatedLink = _link;
      _dedEl.innerHTML = 'Ton ghost est ancré.<br><span class="dedicated-link-hint">Partage ce lien pour le dédier :</span><br><button data-action="copyDedicatedLink" class="dedicated-link-btn">' + _link + '</button>';
    }
  }
}

function _trackDepositSuccessEffects(ghostId, anon, audioUrl, photoUrl, location) {
  // Incrémenter compteur cumulatif (persiste même si ghost supprimé/expiré)
  const _depKey = 'ghostub_total_deposited_' + (currentUser ? currentUser.uid : 'anon');
  localStorage.setItem(_depKey, (parseInt(localStorage.getItem(_depKey) || '0') + 1).toString());
  // Particules dorées
  setTimeout(() => _launchDepositParticles(), 80);
  showToast('success', t.dep_success);
  // Badge premier déposant dans ce lieu
  if (userLat && userLng) {
    const _dFields = buildGeohashFields(userLat, userLng);
    if (_dFields && _dFields.geohash5) {
      _checkFirstDepositor(userLat, userLng, _dFields.geohash5).then(isFirst => {
        if (isFirst) setTimeout(() => {
          showToast('info', '🏅 ' + (_currentLang === 'en' ? 'First ghost in this place!' : 'Premier fantôme de ce lieu !'), 5000);
          showNotif('🏅 Pionnier !', _currentLang === 'en'
            ? 'Your ghost is the first in this place. It will be remembered.'
            : 'Ton fantôme est le premier ici. Il restera.');
        }, 2200);
      }).catch(()=>{});
    }
  }
  // Notifier les utilisateurs qui ont des fantômes dans ce périmètre
  _notifyNearbyUsers(ghostId, userLat, userLng, location || 'ce lieu').catch(e => console.warn('notify:', e));
  playDepositSound();
  HapticsService.deposit();
  Analytics.track('ghost_deposited', { anonymous: anon, hasAudio: !!audioUrl, hasPhoto: !!photoUrl });
}

// Clic pour fermer manuellement si le timer bloque.
// CSP audit 4.6 : la protection reposait sur _requestSuccessNotif()
// appelant e.stopPropagation() pendant que son onclick="" tournait
// directement sur le bouton, avant que l'événement ne remonte jusqu'ici.
// Le dispatcher délégué (zone 0b) écoute sur document, donc son propre
// gestionnaire tourne APRÈS ce listener-ci dans l'ordre de bulle —
// stopPropagation() y arriverait trop tard. Garde plutôt ici, à la
// source, indépendante de l'ordre d'écoute.
function _armDepositSuccessDismiss() {
  const successEl = document.getElementById('depositSuccess');
  const dismissSuccess = (e) => {
    if (e.target.closest('#successNotifBtn')) return;
    successEl.classList.remove('show');
    successEl.removeEventListener('click', dismissSuccess);
    showScreen('screenRadar');
    setNav('nav-radar');
    // Délai pour laisser Firestore propager le nouveau fantôme
    setTimeout(() => loadNearbyGhosts().catch(() => {}), 1500);
  };
  successEl.addEventListener('click', dismissSuccess);
  setTimeout(() => dismissSuccess(), 6000);
}

window.depositGhost = async () => {
  // Verrou synchrone anti double-tap : sans lui, deux taps rapprochés peuvent
  // chacun passer la vérification de cooldown (asynchrone) avant que le
  // timestamp de cooldown ne soit écrit, et créer deux fantômes.
  if (window._depositingGhost) return;
  window._depositingGhost = true;
  const depositBtn = document.getElementById('depositBtn');
  depositBtn.disabled = true;
  try {
    const { location, emoji, duration, maxOpenCount, radius, anon, err } = _readDepositFormInputs();

    const message = _buildDepositMessage();
    if (message === null) return;

    if (!message) { err.textContent = t.dep_err_msg; document.getElementById('depositMsg').focus(); return; }
    if (message.length > 600) { err.textContent = t.dep_err_long; return; }
    if (!userLat) {
      // Tenter une dernière fois
      try { await getLocation(); } catch(e) { console.warn('[ghostub:depositGhost:gps]', e); }
      if (!userLat) { err.textContent = t.dep_err_gps; return; }
    }
    if (!navigator.onLine) { err.textContent = t.dep_err_offline; return; }

    err.textContent = '';
    if (!(await _verifyDepositAllowed(err))) return;

    const hasMedia = !!(window._pendingAudioBlob || window._pendingPhotoFile || window._pendingVideoFile || (Array.isArray(window._pendingAttachments) && window._pendingAttachments.length > 0));
    const uploadResult = await _uploadDepositMedia(depositBtn, err, hasMedia);
    if (!uploadResult) return;

    try {
      if (hasMedia) depositBtn.textContent = t.dep_btn_saving;
      const ghostData = _buildGhostDepositPayload(uploadResult, { message, location, emoji, duration, radius, maxOpenCount, anon });
      const ghostId = await _submitGhostDeposit(ghostData, depositBtn, err);
      if (!ghostId) return;

      _resetDepositStateAfterSuccess(depositBtn);
      _showDepositSuccessScreen(ghostId);
      _trackDepositSuccessEffects(ghostId, anon, ghostData.audioUrl, ghostData.photoUrl, location);
      _armDepositSuccessDismiss();
    } catch(e) {
      console.warn('depositGhost error:', e);
      err.textContent = e.code === 'permission-denied'
        ? t.dep_err_denied
        : (t.dep_err_generic || 'Erreur lors du dépôt — vérifie ta connexion et réessaie.');
      setLoading(depositBtn, false, t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme');
    }
  } finally {
    window._depositingGhost = false;
    depositBtn.disabled = false;
  }
};

window.sendReply = async () => {
  const msgEl = document.getElementById('replyMsg');
  const msg  = msgEl.value.trim();
  const anon = document.querySelector('#screenReply .type-btn.active')?.dataset.val === 'anon';
  if (!msg || !selectedGhost) {
    if (!msg) { msgEl.style.borderColor = 'rgba(255,100,100,.5)'; setTimeout(() => msgEl.style.borderColor = '', 1500); }
    return;
  }
  if (msg.length > 280) {
    showToast('warning', t.reply_long);
    return;
  }
  const btn = document.querySelector('#screenReply .btn-primary');
  if (btn) setLoading(btn, true);
  try {
    const _replyRef = await addDoc(collection(db, COLL.REPLIES), {
      ghostId: selectedGhost.id,
      message: msg,
      anonymous: anon,
      // FIX confidentialité : une réponse anonyme ne doit JAMAIS stocker le pseudo/email
      // en clair (le doc /replies est lisible par tout utilisateur connecté).
      author: anon ? null : (currentUser.displayName || currentUser.email),
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    // Notifier l'auteur du fantôme si ce n'est pas soi-même
    if (selectedGhost.authorUid && selectedGhost.authorUid !== currentUser.uid) {
      addDoc(collection(db, COLL.NOTIFS), {
        type: 'reply',
        toUid: selectedGhost.authorUid,
        ghostId: selectedGhost.id,
        // replyId : preuve d'une interaction réelle exigée par firestore.rules
        // (cf. Audit-5) — sans ça, la notif référence une réponse fantoche.
        replyId: _replyRef.id,
        ghostLocation: selectedGhost.location || t.detail_location_unknown,
        fromAuthor: anon ? '👻 Anonyme' : (currentUser.displayName || 'Quelqu\'un'),
        reactionContent: msg.slice(0, 40),
        notified: false,
        createdAt: serverTimestamp()
      }).catch(() => {});
    }
    msgEl.value = '';
    updateReplyCount(msgEl);
    showToast('success', t.reply_sent);
    openGhost(selectedGhost.id);
    Analytics.track('reply_sent');
  } catch(e) {
    showToast('error', t.toast_delete_err);
  } finally {
    if (btn) setLoading(btn, false, t.detail_reply_ghost_btn);
  }
};

// ── RÉACTION COURTE (juin 2026) ──────────────────────────
// Remplace l'ancien système de réponse libre par une réaction de 3 mots
// maximum, toujours anonyme (pas de sélecteur d'identité — on garde ça léger).
window.sendMicroReply = async () => {
  const input = document.getElementById('microReplyInput');
  if (!input || !selectedGhost || !currentUser) return;
  const msg = input.value.trim();
  if (!msg) return;
  const wordCount = msg.split(/\s+/).filter(Boolean).length;
  if (wordCount > 3) {
    input.style.borderColor = 'rgba(255,100,100,.5)';
    showToast('warning', t.micro_reply_max_words);
    setTimeout(() => { input.style.borderColor = ''; }, 1500);
    return;
  }
  const sendBtn = document.getElementById('microReplySend');
  if (sendBtn) sendBtn.disabled = true;
  try {
    const _replyRef = await addDoc(collection(db, COLL.REPLIES), {
      ghostId: selectedGhost.id,
      message: msg,
      anonymous: true,
      author: null,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    if (selectedGhost.authorUid && selectedGhost.authorUid !== currentUser.uid) {
      addDoc(collection(db, COLL.NOTIFS), {
        type: 'reply',
        toUid: selectedGhost.authorUid,
        ghostId: selectedGhost.id,
        replyId: _replyRef.id,
        ghostLocation: selectedGhost.location || t.detail_location_unknown,
        fromAuthor: '👻 Anonyme',
        reactionContent: msg.slice(0, 40),
        notified: false,
        createdAt: serverTimestamp()
      }).catch(() => {});
    }
    input.value = '';
    openGhost(selectedGhost.id);
    Analytics.track('micro_reply_sent');
  } catch(e) {
    console.warn('[ghostub:sendMicroReply]', e);
    showToast('error', t.toast_delete_err);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
};

// Réaction rapide en un tap (emoji) — même mécanisme que sendMicroReply, sans saisie texte
window.sendQuickReaction = async (emoji, btn) => {
  if (!selectedGhost || !currentUser) return;
  if (btn) btn.disabled = true;
  try {
    const _replyRef = await addDoc(collection(db, COLL.REPLIES), {
      ghostId: selectedGhost.id,
      message: emoji,
      anonymous: true,
      author: null,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    if (selectedGhost.authorUid && selectedGhost.authorUid !== currentUser.uid) {
      addDoc(collection(db, COLL.NOTIFS), {
        type: 'reply',
        toUid: selectedGhost.authorUid,
        ghostId: selectedGhost.id,
        replyId: _replyRef.id,
        ghostLocation: selectedGhost.location || t.detail_location_unknown,
        fromAuthor: '👻 Anonyme',
        reactionContent: emoji,
        notified: false,
        createdAt: serverTimestamp()
      }).catch(() => {});
    }
    openGhost(selectedGhost.id);
    Analytics.track('quick_reaction_sent', { emoji });
  } catch(e) {
    console.warn('[ghostub:sendQuickReaction]', e);
    showToast('error', t.toast_delete_err);
  } finally {
    if (btn) btn.disabled = false;
  }
};

async function _doOpenEnvelope() {
  // Vérification + incrémentation FIABLE (serveur) — bloque réellement si la limite est atteinte,
  // même si le client a été manipulé (variable isPremium locale falsifiée, etc.)
  const _quota = await consumeOpenQuota();
  if (!_quota.allowed) {
    if (_quota.networkError) {
      showToast('error', t.open_quota_network_err);
    } else {
      showOpenLimitWarning(0, () => {});
    }
    return;
  }
  // FIX: Enregistrer la découverte ICI, seulement quand l'enveloppe est vraiment ouverte
  if (selectedGhost) {
    const isNewDisc = addDiscovery(selectedGhost.id);
    const discCount = getDiscoveryCount();
    showDiscoveryToast(discCount, isNewDisc);
    if (isNewDisc) {
      WorldService.registerPresence(selectedGhost.id, true).catch(() => {});
      // Incrémenter le compteur d'ouvertures sur le fantôme
      // FIX: Lire le vrai openCount depuis Firestore pour éviter les faux "Premier à lire"
      let realOpenCount = 0;
      try {
        const ghostSnap = await getDoc(doc(db, COLL.GHOSTS, selectedGhost.id));
        realOpenCount = ghostSnap.exists() ? (ghostSnap.data().openCount || 0) : 0;
      } catch(e) {
        realOpenCount = selectedGhost.openCount || 0;
      }
      const newOpenCount = realOpenCount + 1;
      const maxOpen = selectedGhost.maxOpenCount || 0;
      const nowExpired = maxOpen > 0 && newOpenCount >= maxOpen;
      // 🥇 Premier à lire : openCount était 0 dans Firestore
      const wasFirst = realOpenCount === 0;
      if (wasFirst) {
        const firstCount = parseInt(localStorage.getItem('ghostub_first_reader') || '0') + 1;
        localStorage.setItem('ghostub_first_reader', firstCount);
        animateStatNumber('statFirstReader', firstCount);
      }

      // Annotation "vu par X personnes"
      const readCountEl = document.getElementById('detailReadCount');
      if (readCountEl) {
        if (wasFirst) {
          readCountEl.innerHTML = `<span class="first-reader-badge">${t.detail_first_reader || t.detail_first_reader}</span>`;
        } else {
          const prev = selectedGhost.openCount || 0;
          readCountEl.innerHTML = `<span class="already-read-badge">${_currentLang === 'fr' ? '👁 ' + prev + ' personne' + (prev > 1 ? 's ont' : ' a') + t.detail_already_read_suffix || ' lu ce message avant vous' : '👁 ' + prev + ' person' + (prev > 1 ? 's' : '') + ' read this before you'}</span>`;
        }
        readCountEl.style.display = 'block';
      }

      if (wasFirst) showToast('success', t.detail_first_toast, 4000);
      updateDoc(doc(db, COLL.GHOSTS, selectedGhost.id), {
        openCount: increment(1),
        ...(nowExpired ? { expired: true } : {})
      }).catch(() => {
        // Si règles Firestore bloquent (non-auteur), fallback vers ghostStats
        // On écrit aussi expired:true dans ghostStats pour que les autres clients filtrent
        setDoc(doc(db, 'ghostStats', selectedGhost.id), {
          openCount: increment(1),
          ghostId: selectedGhost.id,
          authorUid: selectedGhost.authorUid || null,
          ...(nowExpired ? { expired: true } : {})
        }, { merge: true }).catch(() => {});
      });
      if (nowExpired) {
        showToast('info', t.detail_expired_last, 5000);
        // Disparition IMMÉDIATE côté client : retirer de nearbyGhosts pour que
        // le radar et la liste ne le montrent plus dès que l'utilisateur revient
        if (typeof nearbyGhosts !== 'undefined' && Array.isArray(nearbyGhosts)) {
          const idx = nearbyGhosts.findIndex(g => g.id === selectedGhost.id);
          if (idx !== -1) nearbyGhosts.splice(idx, 1);
        }
        // Marquer aussi sur l'objet local pour que isExpired() le filtre partout
        selectedGhost.expired = true;
        // Tentative de suppression définitive (échouera si non-auteur, c'est OK)
        deleteDoc(doc(db, COLL.GHOSTS, selectedGhost.id)).catch(() => {});
      }
      // Notifier l'auteur si ce n'est pas soi-même
      if (selectedGhost.authorUid && selectedGhost.authorUid !== currentUser?.uid) {
        const lieu = selectedGhost.location || 'ce lieu';
        addDoc(collection(db, COLL.NOTIFS), {
          type: selectedGhost.businessMode ? 'biz_open' : 'open',
          toUid: selectedGhost.authorUid,
          ghostId: selectedGhost.id,
          ghostLocation: lieu,
          notified: false,
          createdAt: serverTimestamp()
        }).catch(() => {});
      }
    }
  }
  const sealed = document.getElementById('envelopeSealed');
  const revealed = document.getElementById('envelopeContent');
  // ── HAPTIC dramatique ───────────────────────────────────
  // Plus de rupture de sceau : on enchaine directement sur le grattage.
  // Le moment fort (flash + particules + vibration) est declenche a la FIN
  // du grattage, dans _completeScratchReveal — la ou la revelation est meritee.
  HapticsService.reveal();
  if (sealed) { sealed.style.transition = 'opacity .18s ease'; sealed.style.opacity = '0'; }
  setTimeout(() => {
    if (sealed) { sealed.style.display = 'none'; sealed.style.opacity = ''; }
    revealed.style.display = 'block';
    revealed.classList.add('envelope-reveal');
    _initScratchReveal();
    const firstFocusable = revealed.querySelector('button, [tabindex]');
    if (firstFocusable) firstFocusable.focus();
  }, 180);
  Analytics.track('envelope_opened');
  // Toast discret post-révélation quand le dernier quota du jour vient d'être consommé.
  // On attend 1.5 s pour ne pas écraser le "🥇 Premier à lire" s'il s'affiche.
  if (!isPremium && _quota.remaining === 0) {
    setTimeout(() => showToast('info', t.open_limit_toast_last, 5000), 1500);
  }
}

// ── SCRATCH-TO-REVEAL ─────────────────────────────────────
// Le canvas est injecté dans #scratchZone (défini dans le HTML).
// Il ne peut pas déborder sur les boutons.

function _initScratchReveal() {
  const zone = document.getElementById('scratchZone');
  if (!zone) return;
  ['detailMessage','detailAudio','detailPhoto','detailReadCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = '0'; el.style.visibility = 'hidden';
      if (id === 'detailMessage') el.classList.remove('ink-revealing');
    }
  });
  setTimeout(_buildScratchCanvas, 250);
}

function _buildScratchCanvas() {
  // Nettoyer canvas précédent
  const oldC = document.getElementById('scratchCanvas'); if (oldC) oldC.remove();
  const oldH = document.getElementById('scratchHint');   if (oldH) oldH.remove();

  const zone = document.getElementById('scratchZone');
  if (!zone) return;
  window._scratchActive = true;

  const dpr  = window.devicePixelRatio || 1;
  const cssW = zone.offsetWidth  || 320;
  const cssH = Math.max(160, zone.offsetHeight);

  // Canvas positionné en absolute dans scratchZone — exactement la même taille
  const canvas = document.createElement('canvas');
  canvas.id = 'scratchCanvas';
  canvas.style.cssText = `position:absolute;inset:0;width:${cssW}px;height:${cssH}px;border-radius:16px;cursor:crosshair;touch-action:none;z-index:10;pointer-events:auto;`;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  zone.appendChild(canvas);

  // Hint (main + texte) collé en bas du canvas
  const hint = document.createElement('div');
  hint.id = 'scratchHint';
  hint.style.cssText = `position:absolute;bottom:0;left:0;width:100%;height:58px;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;z-index:11;pointer-events:none;background:none;transition:opacity .3s;`;
  hint.innerHTML = `<span class="scratch-hint-hand">🖐</span><span class="scratch-hint-text">Frottez pour révéler...</span>`;
  zone.appendChild(hint);

  // Dessiner le voile
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const grad = ctx.createLinearGradient(0,0,cssW,cssH);
  grad.addColorStop(0,   'rgba(14,12,30,0.98)');
  grad.addColorStop(0.5, 'rgba(20,16,42,0.97)');
  grad.addColorStop(1,   'rgba(10,10,22,0.98)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.roundRect(0,0,cssW,cssH,16); ctx.fill();
  // Reflet haut
  const glow = ctx.createRadialGradient(cssW/2,0,0,cssW/2,cssH*0.5,cssW*0.8);
  glow.addColorStop(0,'rgba(168,180,255,0.10)'); glow.addColorStop(1,'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.roundRect(0,0,cssW,cssH,16); ctx.fill();
  // Ghost watermark
  ctx.save();
  ctx.shadowColor='rgba(var(--ghost-blue-rgb),0.5)'; ctx.shadowBlur=20;
  ctx.globalAlpha=0.30;
  const wmSz = Math.min(cssW, cssH) * 0.55;
  ctx.drawImage(_brandImg, cssW/2 - wmSz/2, cssH/2 - wmSz/2, wmSz, wmSz);
  ctx.restore();

  // Grattage
  let isDrawing=false, revealed=false, lastX=0, lastY=0, checkTimer=null;

  function getPos(e) {
    const r=canvas.getBoundingClientRect(), src=e.touches?e.touches[0]:e;
    return {x:(src.clientX-r.left)*(cssW/r.width), y:(src.clientY-r.top)*(cssH/r.height)};
  }
  function scratchAt(x,y,fromMove) {
    if(revealed) return;
    ctx.globalCompositeOperation='destination-out';
    ctx.lineWidth=60; ctx.lineCap='round'; ctx.lineJoin='round';
    if(fromMove){ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();}
    ctx.beginPath(); ctx.arc(x,y,32,0,Math.PI*2); ctx.fill();
    lastX=x; lastY=y;
    if(!checkTimer) checkTimer=setTimeout(()=>{checkTimer=null;if(!revealed)checkPct();},150);
  }
  function checkPct() {
    if(revealed) return;
    const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let cleared=0,total=0; for(let i=3;i<d.length;i+=4*16){total++;if(d[i]<100)cleared++;}
    if(total>0 && cleared/total>0.50){revealed=true;clearTimeout(checkTimer);_completeScratchReveal(canvas,hint,zone);}
  }
  function onStart(e){e.preventDefault();e.stopPropagation();isDrawing=true;hint.style.opacity='0';const p=getPos(e);lastX=p.x;lastY=p.y;scratchAt(p.x,p.y,false);}
  function onMove(e){if(!isDrawing)return;e.preventDefault();e.stopPropagation();const p=getPos(e);scratchAt(p.x,p.y,true);}
  function onEnd(){isDrawing=false;}
  canvas.addEventListener('mousedown',onStart);
  canvas.addEventListener('mousemove',onMove);
  canvas.addEventListener('mouseup',onEnd);
  canvas.addEventListener('mouseleave',onEnd);
  canvas.addEventListener('touchstart',onStart,{passive:false});
  canvas.addEventListener('touchmove',onMove,{passive:false});
  canvas.addEventListener('touchend',onEnd);
  canvas.addEventListener('touchcancel',onEnd);
}

function _completeScratchReveal(canvas, hint, zone) {
  window._scratchActive = false;
  const flash=document.getElementById('sealBreakFlash');
  if(flash){flash.style.animation='none';flash.offsetHeight;flash.style.animation='sealFlash 0.5s ease-out forwards';}
  if(navigator.vibrate) navigator.vibrate([15,30,15,60,120]);
  canvas.style.transition='opacity .5s ease'; canvas.style.opacity='0';
  hint.style.opacity='0';
  setTimeout(()=>{
    canvas.remove(); hint.remove();
    // Révéler les éléments intérieurs
    ['detailMessage','detailAudio','detailPhoto','detailReadCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.visibility = 'visible';
        if (id === 'detailMessage') {
          el.style.opacity = '1';
          el.classList.add('ink-revealing');
        } else {
          el.style.transition = 'opacity .35s ease';
          el.style.opacity = '1';
        }
      }
    });
    // Apparition mot par mot du message
    setTimeout(()=>{
      const m=document.getElementById('detailMessage');
      if(m){const ft=m.textContent||'';if(ft.trim().length>1){m.textContent='';const w=ft.split(' ').filter(Boolean);let i=0;const iv=setInterval(()=>{if(i<w.length){m.textContent+=(i===0?'':' ')+w[i++];}else{clearInterval(iv);if(navigator.vibrate)navigator.vibrate(50);}},70);}}
    },120);
  },520);
}



function showDistanceError(dist) {
  const btn = document.getElementById('envelopeOpenBtn');
  const hint = document.getElementById('sealedHint');
  // Vibration d'erreur
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  // Animation shake sur le bouton
  btn.classList.add('btn-shake');
  setTimeout(() => btn.classList.remove('btn-shake'), 600);
  // Message de distance
  const meters = Math.round(dist);
  hint.innerHTML = `<span class="scratch-locked-hint">🌫️ Le sceau résiste encore<br><span class="scratch-locked-hint-sub">encore ${meters}m à parcourir</span></span>`;
  // Reset après 4s
  setTimeout(() => {
    hint.textContent = t.detail_sealed_hint;
    hint.style.color = '';
  }, 4000);
}

function showOpenLimitWarning(remaining, onConfirm) {
  const modal = document.getElementById('openLimitModal');
  const dots  = document.getElementById('openLimitDots');
  const sub   = document.getElementById('openLimitSub');
  const icon  = document.getElementById('openLimitIcon');
  const premium = document.getElementById('openLimitPremiumInfo');
  const okBtn = document.getElementById('openLimitOkBtn');
  const cancelBtn = document.getElementById('openLimitCancelBtn');

  // Dots visuels
  dots.innerHTML = Array.from({length: DAILY_OPEN_LIMIT}, (_,i) =>
    `<div class="open-limit-dot${i >= remaining ? ' used' : ''}"></div>`
  ).join('');

  if (remaining === 0) {
    icon.textContent = '🌙';
    document.getElementById('openLimitTitle').textContent = t.open_limit_title_done;
    sub.innerHTML = t.open_limit_sub_done;
    okBtn.style.display = 'none';
    premium.style.display = 'block';
  } else {
    icon.innerHTML = remaining === 1 ? '⚠️' : '<img src="assets/brand/ghostub-mark-trace.svg" class="open-limit-icon-img" aria-hidden="true">';
    document.getElementById('openLimitTitle').textContent = remaining === 1 ? t.open_limit_title_last : t.open_limit_title_remaining.replace('{n}', remaining).replace('{s}', remaining > 1 ? 's' : '');
    sub.innerHTML = remaining === 1
      ? t.open_limit_sub_last
      : t.open_limit_sub_remaining.replace(/{n}/g, remaining).replace('{s}', remaining > 1 ? 's' : '');
    okBtn.style.display = '';
    okBtn.textContent = remaining === 1 ? t.open_limit_btn_last : t.open_limit_btn;
    premium.style.display = remaining <= 1 ? 'block' : 'none';
  }

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  const cleanup = () => {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  };
  const onOk = () => { cleanup(); onConfirm(true); };
  const onCancel = () => { cleanup(); onConfirm(false); };
  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
  setTimeout(() => (remaining > 0 ? okBtn : cancelBtn).focus(), 80);
}

window.openEnvelope = async () => {
  // Verrou synchrone anti double-appel : entre le tap et la vérification du
  // quota (réseau) puis le callback géoloc (async), un second tap pouvait
  // jusqu'ici déclencher un second flux concurrent et faire consommer deux
  // unités du quota quotidien pour une seule action perçue par l'utilisateur.
  if (window._openingEnvelope) return;
  window._openingEnvelope = true;
  try {
    if (!selectedGhost) return;
    // Vérifier si déjà ouvert (pas de vérif distance pour relecture)
    const revealed = document.getElementById('envelopeContent');
    if (revealed && revealed.style.display !== 'none') return; // déjà ouvert — ne pas reincrémenter

    // ── Vérifier limite journalière AVANT la distance ───────
    // Quota déjà épuisé : on bloque complètement.
    // Avant-dernière/dernière ouverture (remaining 1 ou 2) : avertissement
    // progressif avec possibilité d'annuler, pour ne pas surprendre l'utilisateur
    // au moment où le quota tombe réellement à 0.
    const remaining = await remainingOpensToday();
    if (!isPremium && remaining === 0) {
      showOpenLimitWarning(0, () => {});
      return;
    }
    if (!isPremium && (remaining === 1 || remaining === 2)) {
      const confirmed = await new Promise(resolve => showOpenLimitWarning(remaining, resolve));
      if (!confirmed) return;
    }
    await _checkDistanceThenOpen();
  } finally {
    window._openingEnvelope = false;
  }
};

// Retourne une Promise qui ne se résout qu'une fois le flux entièrement
// terminé (géoloc + éventuel _doOpenEnvelope()) — nécessaire pour que le
// verrou synchrone posé dans openEnvelope() reste actif pendant toute la
// durée de l'opération, callback géoloc compris (cf. problème 5).
function _checkDistanceThenOpen() {
  return new Promise((resolve) => {
    const btn = document.getElementById('envelopeOpenBtn');
    const hint = document.getElementById('sealedHint');
    const origHint = hint.textContent;

    btn.disabled = true;
    hint.textContent = t.env_gps_checking;
    // FIX: Timeout de sécurité si géoloc bloque trop longtemps
    const fallbackTimer = setTimeout(() => {
      btn.disabled = false;
      hint.textContent = t.env_gps_slow;
      setTimeout(() => { hint.textContent = origHint; }, 4000);
      resolve();
    }, 8000);

    if (!navigator.geolocation) {
      clearTimeout(fallbackTimer);
      btn.disabled = false;
      hint.textContent = t.env_gps_unavail;
      setTimeout(() => { hint.textContent = origHint; }, 4000);
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(fallbackTimer);
        btn.disabled = false;
        const dist = distanceMeters(
          pos.coords.latitude, pos.coords.longitude,
          selectedGhost.lat, selectedGhost.lng
        );
        const ghostRadiusStr = selectedGhost.radius || '50m';
        const ghostRadius = Math.max(20, parseInt(ghostRadiusStr) || 50);
        // Prendre en compte l'imprécision GPS : si dist - accuracy <= ghostRadius, on laisse passer
        const accuracy = pos.coords.accuracy || 0;
        const effectiveDist = Math.max(0, dist - accuracy * 0.5);
        if (effectiveDist <= ghostRadius) {
          hint.textContent = origHint;
          await _doOpenEnvelope();
        } else {
          showDistanceError(dist);
        }
        resolve();
      },
      () => {
        clearTimeout(fallbackTimer);
        btn.disabled = false;
        // Fallback : utiliser la position radar déjà connue si disponible
        if (userLat && userLng) {
          const dist = distanceMeters(userLat, userLng, selectedGhost.lat, selectedGhost.lng);
          const ghostRadiusStr = selectedGhost.radius || '50m';
          const ghostRadius = Math.max(20, parseInt(ghostRadiusStr) || 50);
          if (dist <= ghostRadius) {
            hint.textContent = origHint;
            _doOpenEnvelope().then(resolve);
            return;
          } else {
            showDistanceError(dist);
          }
        } else {
          hint.textContent = t.env_gps_denied;
          setTimeout(() => { hint.textContent = origHint; }, 4000);
        }
        resolve();
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 5000 }
    );
  });
};

// ── HISTORIQUE NAVIGATION ──────────────────────────────
let _navHistory = [];
let _navInProgress = false;

window.addEventListener('popstate', (e) => {
  if (_navInProgress) return;
  const screenId = e.state?.screen;
  if (screenId) {
    _navInProgress = true;
    showScreen(screenId, true); // true = depuis popstate, ne pas push
    _navInProgress = false;
  }
});

// Audit 6.4 : nommée explicitement (au lieu d'un window.showScreen anonyme
// capturé plus bas dans _showScreenOrig) — le pattern "capture puis écrase"
// dépendait entièrement de l'ordre d'exécution du script ; un futur
// déplacement de code entre les deux définitions l'aurait cassé en silence.
function _showScreenBase(id, fromPopstate = false) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Reset scroll
  const scroll = document.querySelector('#' + id + ' .scroll');
  if (scroll) scroll.scrollTop = 0;
  // Push dans l'historique navigateur sauf si on revient en arrière
  if (!fromPopstate) {
    history.pushState({ screen: id }, '', window.location.href.split('?')[0] + window.location.search);
  }
  if (id === 'screenMap') setTimeout(() => renderStaticMap(), 50);
  if (id === 'screenProfile') { refreshProfileStats(); _leaderboardLoaded = false;
    _setNotifBtnState(localStorage.getItem('notif_enabled') === '1'); const lp = document.getElementById('leaderboardPanel'); if (lp) lp.style.display = 'none'; loadEmpreinteMap(); loadBizDashboard(); }
  if (id === 'screenOnboard') {
    const btn = document.getElementById('obBackBtn');
    if (btn) btn.style.display = currentUser ? 'flex' : 'none';
    goObScene(0);
  }
  // Autofocus sur le premier input
  setTimeout(() => {
    if (id === 'screenAuth') {
      const firstInput = document.querySelector('#tabLogin:not([style*="none"]) .form-input, #tabRegister:not([style*="none"]) .form-input');
      if (firstInput) firstInput.focus();
    }
    if (id === 'screenReply') {
      document.getElementById('replyMsg')?.focus();
    }
  }, 350);

  if (id === 'screenDeposit') {
    setWizardStep(1);
    // Reset business mode complet
    const normalForm = document.getElementById('normalDepositForm');
    const bizForm    = document.getElementById('businessDepositForm');
    const extra      = document.getElementById('businessExtra');
    const icon       = document.getElementById('businessToggleIcon');
    const btn2       = document.getElementById('businessToggleBtn');
    const subLabel   = document.getElementById('bizToggleSubLabel');
    if (normalForm) normalForm.style.display = 'block';
    if (bizForm)    bizForm.style.display    = 'none';
    if (extra)      extra.style.display      = 'none';
    if (icon)       icon.textContent         = '○';
    if (btn2)       { btn2.style.borderColor = 'rgba(var(--premium-rgb),.2)'; btn2.style.background = 'rgba(var(--premium-rgb),.06)'; }
    if (subLabel)   { subLabel.textContent = t.dep_biz_sub; subLabel.style.color = 'rgba(255,235,180,1)'; }
    // Reset step 2 sections
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id2 => {
      const el = document.getElementById(id2); if (el) el.style.display = '';
    });
    // Reset step 3 (Lot Q : Identité retirée, menu média replié par défaut)
    _resetAnonToggle();
    ['step3VocalWrap','step3PhotoWrap','step3VideoWrap','step3AttachmentsWrap'].forEach(id2 => {
      const el = document.getElementById(id2); if (el) el.style.display = 'none';
    });
    if (typeof window.toggleMediaMenu === 'function') window.toggleMediaMenu(false);
    const vocalMenuItem = document.getElementById('mediaMenuItemVocal');
    if (vocalMenuItem) vocalMenuItem.style.display = '';
    const t3 = document.getElementById('step3Title');
    const s3 = document.getElementById('step3Sub');
    const depBtn = document.getElementById('depositBtn');
    if (t3) t3.textContent = t.dep_pane3_title;
    if (s3) s3.textContent = t.dep_pane3_sub;
    if (depBtn) depBtn.textContent = t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme';
    // Reset champs bizTitle/bizDesc
    const bizTitle = document.getElementById('bizTitle');
    const bizDesc  = document.getElementById('bizDesc');
    if (bizTitle) bizTitle.value = '';
    if (bizDesc)  bizDesc.value  = '';
    // Reset condition d'ouverture
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    const alwaysBtn = document.querySelector('.cond-btn[data-cond="always"]');
    if (alwaysBtn) alwaysBtn.classList.add('active');
    document.getElementById('condExtraHour')?.classList.remove('show');
    document.getElementById('condExtraAfter')?.classList.remove('show');
    document.getElementById('condExtraFuture')?.classList.remove('show');
    // Reset accordéon Condition d'ouverture (Lot H3) — replié, résumé "always"
    if (typeof window.toggleCondAccordion === 'function') window.toggleCondAccordion(false);
    if (typeof _updateCondAccordionSummary === 'function') _updateCondAccordionSummary();
    // Referme aussi les accordéons Rayon / Durée de vie / Disparaît après
    // (Lot N) — la sélection elle-même n'est pas réinitialisée, seul l'état
    // ouvert/fermé l'est, pour éviter qu'ils restent ouverts d'une visite à l'autre.
    if (typeof window.toggleRadiusAccordion === 'function') window.toggleRadiusAccordion(false);
    if (typeof window.toggleDurAccordion === 'function') window.toggleDurAccordion(false);
    if (typeof window.toggleMaxOpenAccordion === 'function') window.toggleMaxOpenAccordion(false);
    // Referme aussi Identité / Type d'offre (Lot O)
    if (typeof window.toggleIdentityAccordion === 'function') window.toggleIdentityAccordion(false);
    if (typeof window.toggleBizTypeAccordion === 'function') window.toggleBizTypeAccordion(false);
    const chainContent = document.getElementById('chainContent');
    const chainLock = document.getElementById('chainLock');
    const chainSection = document.getElementById('premSection_chain');
    // Reset depositSuccess overlay
    document.getElementById('depositSuccess')?.classList.remove('show');
    if (chainSection) chainSection.style.position = 'relative';
    if (!isPremium) {
      if (chainContent) { chainContent.style.opacity = '0.3'; chainContent.style.pointerEvents = 'none'; }
      if (chainLock) chainLock.style.display = 'flex';
    } else {
      if (chainContent) { chainContent.style.opacity = '1'; chainContent.style.pointerEvents = ''; }
      if (chainLock) chainLock.style.display = 'none';
    }
    if (typeof _updateMaxOpenLockUI === 'function') _updateMaxOpenLockUI();
    // Lieu + sections Premium toujours visibles désormais (Lot H1) — plus
    // besoin d'attendre l'ouverture d'un onglet/nappe pour les initialiser.
    setTimeout(_initDepositMiniMap, 80);
    // Auto-remplir le nom du lieu via reverse geocoding si vide (reporté ici
    // depuis l'ancien wizardNext(1), disparu avec la fusion en une seule page)
    const locInput = document.getElementById('depositLocation');
    if (locInput && userLat && !locInput.value) {
      locInput.placeholder = t.dep_loc_searching;
      reverseGeocode(userLat, userLng).then(name => {
        if (name && !locInput.value) {
          locInput.value = name;
          locInput.style.borderColor = 'rgba(var(--accent-green-rgb),.4)';
          setTimeout(() => locInput.style.borderColor = '', 1500);
        }
        locInput.placeholder = 'ex: Banc du parc, Café du coin…';
      });
    }
    updatePremiumUI();
  }
  if (id === 'screenDetail') {
    const sealed = document.getElementById('envelopeSealed');
    const revealed = document.getElementById('envelopeContent');
    sealed.style.display = '';
    sealed.classList.remove('opening', 'opened');
    revealed.style.display = 'none';
    revealed.classList.remove('envelope-reveal');
  }
  // Mettre à jour le titre de la page pour screen reader
  const screenTitles = {
    screenRadar:   t.misc_screen_radar   || 'Ghostub',
    screenDetail:  t.misc_screen_detail  || 'Ghostub',
    screenDeposit: t.misc_screen_deposit || 'Ghostub',
    screenMap:     t.misc_screen_map     || 'Ghostub',
    screenProfile: t.misc_screen_profile || 'Ghostub',
    screenAuth:    t.misc_screen_auth    || 'Ghostub',
    screenOnboard: 'Ghostub',
    screenReply:   t.misc_screen_reply   || 'Ghostub',
  };
  document.title = screenTitles[id] || 'Ghostub';
}
window.showScreen = _showScreenBase;


// ── CONDITIONS D'OUVERTURE ────────────────────────────────
window.toggleBusinessMode = () => {
  if (!isPremium) {
    showToast('warning', t.dep_biz_locked, 4000);
    setTimeout(() => { showScreen('screenProfile'); setNav('nav-profile'); }, 1500);
    return;
  }
  const normalForm = document.getElementById('normalDepositForm');
  const bizForm    = document.getElementById('businessDepositForm');
  const extra      = document.getElementById('businessExtra');
  const icon       = document.getElementById('businessToggleIcon');
  const btn        = document.getElementById('businessToggleBtn');
  const subLabel   = document.getElementById('bizToggleSubLabel');

  const activating = _depositMode !== 'business';

  if (activating) {
    _depositMode = 'business';
    window._depositMode = _depositMode;
    // Remettre à l'étape 1 et scroller en haut
    if (typeof setWizardStep === 'function') setWizardStep(1);
    document.getElementById('screenDeposit')?.querySelector('.scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    // Basculer vers le formulaire Commerce
    normalForm.style.display = 'none';
    bizForm.style.display    = 'block';
    extra.style.display      = 'block'; // pour compatibilité depositGhost
    icon.textContent         = '●';
    btn.style.borderColor    = 'rgba(var(--premium-rgb),.6)';
    btn.style.background     = 'rgba(var(--premium-rgb),.1)';
    subLabel.textContent     = t.dep_biz_active;
    subLabel.style.color     = 'rgba(var(--premium-rgb),.7)';
    document.getElementById('depositEmoji').value = '🏪';
    // Masquer durée/disparaît/rayon/condition dans step 2
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Masquer vocal/chaîne dans step 3 (Lot Q : retiré du menu média, pas
    // seulement de l'affichage — pas de message vocal pour une offre Commerce),
    // adapter titre
    const vocalMenuItemBiz = document.getElementById('mediaMenuItemVocal');
    if (vocalMenuItemBiz) vocalMenuItemBiz.style.display = 'none';
    const vocalPanelBiz = document.getElementById('step3VocalWrap');
    if (vocalPanelBiz) vocalPanelBiz.style.display = 'none';
    const t3 = document.getElementById('step3Title');
    const s3 = document.getElementById('step3Sub');
    if (t3) t3.textContent = t.dep_biz_visual_title || 'Ajouter un visuel';
    if (s3) s3.textContent = t.dep_biz_visual_sub || t.dep_biz_media_hint || 'Photo ou vidéo pour illustrer votre offre (optionnel).';
    const depBtn = document.getElementById('depositBtn');
    if (depBtn) depBtn.textContent = t.dep_biz_deposit || '🏪 Publier cette offre';
    // Forcer durée 1 mois + rayon 50m
    // ⚠️ Matché via data-dur (marqueur interne stable), pas via .textContent
    // comparé à t.dep_dur_1m (chaîne traduite) : une course avec le rendu
    // i18n ou un simple écart d'espace faisait échouer silencieusement TOUT
    // le bloc — aucun bouton ne devenait actif, et depositGhost() retombait
    // alors sur '7 jours' par défaut pour un dépôt Commerce (audit 1.4).
    setTimeout(() => {
      document.querySelectorAll('.dur-btn:not([data-maxopen])').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        if (b.dataset.dur === '1m') {
          b.classList.add('active');
          b.setAttribute('aria-pressed', 'true');
        }
      });
      document.querySelectorAll('.radius-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        if (b.textContent.trim() === '50m') {
          b.classList.add('active');
          b.setAttribute('aria-pressed', 'true');
        }
      });
      // Resynchroniser les résumés d'accordéon (Lot O) — ces changements
      // forcés ne passent pas par le clic délégué qui les met à jour d'habitude.
      if (typeof _updateDurAccordionSummary === 'function') _updateDurAccordionSummary();
      if (typeof _updateRadiusAccordionSummary === 'function') _updateRadiusAccordionSummary();
      // Le chemin forcé contourne _selectRadius() (qui l'appelle normalement) —
      // sans ça, l'aperçu du rayon sur la mini-carte restait visuellement
      // périmé après un forçage à 50m (audit 1.4).
      if (typeof _updateRadiusCircle === 'function') _updateRadiusCircle();
    }, 100);
    showToast('success', t.dep_biz_toast);
  } else {
    _depositMode = 'normal';
    window._depositMode = _depositMode;
    // Retour au formulaire normal
    normalForm.style.display = 'block';
    bizForm.style.display    = 'none';
    extra.style.display      = 'none';
    icon.textContent         = '○';
    btn.style.borderColor    = 'rgba(var(--premium-rgb),.2)';
    btn.style.background     = 'rgba(var(--premium-rgb),.06)';
    subLabel.textContent     = t.dep_biz_sub;
    subLabel.style.color     = 'rgba(255,235,180,1)';
    // Réafficher les sections step 2
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    // Réafficher le message vocal dans le menu média (Lot Q) — le panneau
    // lui-même reste replié tant qu'il n'est pas choisi dans le menu.
    const vocalMenuItemNorm = document.getElementById('mediaMenuItemVocal');
    if (vocalMenuItemNorm) vocalMenuItemNorm.style.display = '';
    const t3b = document.getElementById('step3Title');
    const s3b = document.getElementById('step3Sub');
    if (t3b) t3b.textContent = t.dep_pane3_title;
    if (s3b) s3b.textContent = t.dep_pane3_sub;
    const depBtnB = document.getElementById('depositBtn');
    if (depBtnB) depBtnB.textContent = t.dep_seal_btn || t.dep_deposit_btn || 'Sceller le fantôme';
  }
};

window.selectCond = (btn) => {
  // Vérif Premium AVANT de retirer la classe active (sinon aucun bouton sélectionné)
  if (btn.dataset.cond === 'future' && !isPremium) {
    showToast('info', t.dep_cond_premium, 3500);
    return;
  }
  // v105: feature 'after' supprimée (redondante avec chaîne de fantômes Premium)
  btn.closest('.cond-selector').querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cond = btn.dataset.cond;
  document.getElementById('condExtraHour')?.classList.toggle('show', cond === 'hour');
  document.getElementById('condExtraFuture')?.classList.toggle('show', cond === 'future');
  // Pré-remplir la date min à demain
  if (cond === 'future') {
    const inp = document.getElementById('condFutureInput');
    if (!inp.value) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      inp.min = tomorrow.toISOString().split('T')[0];
      // Proposer dans 1 an par défaut
      const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
      inp.value = nextYear.toISOString().split('T')[0];
    }
  }
};

function getSelectedCond() {
  const btn = document.querySelector('.cond-btn.active[data-cond]');
  return btn ? btn.dataset.cond : 'always';
}

function isConditionMet(ghost) {
  const cond = ghost.openCondition || 'always';

  if (cond === 'always') return { ok: true };

  if (cond === 'night') {
    const h = new Date().getHours();
    const isNight = h >= 22 || h < 6;
    if (isNight) return { ok: true };
    // Calculer combien de temps avant la nuit
    const now = new Date();
    let nextNight = new Date(now);
    if (h >= 6 && h < 22) {
      nextNight.setHours(22, 0, 0, 0);
    }
    const diff = nextNight - now;
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    return {
      ok: false,
      icon: '🌙',
      title: t.blocked_night_title,
      sub: t.blocked_night_sub,
      timer: `${hh}h${mm < 10 ? '0' + mm : mm}`,
      timerLabel: t.blocked_night_timer || 'avant la nuit'
    };
  }

  if (cond === 'hour') {
    const targetTime = ghost.openHour || '20:00';
    const [th, tm] = targetTime.split(':').map(Number);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const targetMin = th * 60 + tm;
    const diff = Math.abs(nowMin - targetMin);
    const diffAlt = 1440 - diff; // wrap autour de minuit
    const closest = Math.min(diff, diffAlt);
    if (closest <= 15) return { ok: true };
    // Calculer le temps restant
    let waitMin;
    if (nowMin < targetMin) {
      waitMin = targetMin - nowMin;
    } else {
      waitMin = 1440 - nowMin + targetMin;
    }
    const hh = Math.floor(waitMin / 60);
    const mm = waitMin % 60;
    const fmt12 = th > 12 ? `${th-12}h${tm < 10 ? '0'+tm : tm}` : `${th}h${tm < 10 ? '0'+tm : tm}`;
    return {
      ok: false,
      icon: '⏰',
      title: (_currentLang === 'fr' ? `Rendez-vous à ${fmt12}` : `Appointment at ${fmt12}`),
      sub: t.blocked_hour_sub.replace('{time}', fmt12),
      timer: hh > 0 ? `${hh}h${mm < 10 ? '0'+mm : mm}` : `${mm} min`,
      timerLabel: t.blocked_hour_timer || 'avant l’ouverture'
    };
  }

  if (cond === 'after') {
    // v105 : feature supprimée. Anciens ghosts avec cond=after passent automatiquement.
    return { ok: true };
  }

  if (cond === 'future') {
    const openDate = ghost.openDate;
    if (!openDate) return { ok: true };
    const unlockTs = new Date(openDate).setHours(0, 0, 0, 0);
    const now = Date.now();
    if (now >= unlockTs) return { ok: true };
    const diff = unlockTs - now;
    const days = Math.ceil(diff / 86400000);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    let timer, timerLabel;
    if (years >= 1) { timer = `${years} ${_currentLang === 'fr' ? 'an' + (years > 1 ? 's' : '') : 'year' + (years > 1 ? 's' : '')}`; timerLabel = t.blocked_future_timer || 'avant l\'ouverture'; }
    else if (months >= 1) { timer = `${months} mois`; timerLabel = 'avant l’ouverture'; }
    else { timer = `${days} jour${days > 1 ? 's' : ''}`; timerLabel = 'avant l’ouverture'; }
    const dateStr = new Date(openDate).toLocaleDateString(_currentLang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      ok: false,
      icon: '📅',
      title: t.blocked_future_title,
      sub: t.blocked_future_sub.replace('{date}', dateStr),
      timer,
      timerLabel
    };
  }

  return { ok: true };
}

function showBlockedOverlay(result) {
  const overlay  = document.getElementById('ghostBlockedOverlay');
  const sealed   = document.getElementById('envelopeSealed');
  const icon     = document.getElementById('blockedIcon');
  const title    = document.getElementById('blockedTitle');
  const sub      = document.getElementById('blockedSub');
  const timer    = document.getElementById('blockedTimer');
  const timerLbl = document.getElementById('blockedTimerLabel');

  icon.textContent  = result.icon  || '🌙';
  title.textContent = result.title || 'Pas encore accessible';
  sub.textContent   = result.sub   || '';

  if (result.timer) {
    timer.textContent    = result.timer;
    timerLbl.textContent = result.timerLabel || '';
    timer.style.display    = 'block';
    timerLbl.style.display = 'block';
  } else {
    timer.style.display    = 'none';
    timerLbl.style.display = 'none';
  }

  overlay.classList.add('show');
  sealed.style.display = 'none';
  if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
}

// Reset overlay quand on change de fantôme
function resetBlockedOverlay() {
  const overlay = document.getElementById('ghostBlockedOverlay');
  const sealed  = document.getElementById('envelopeSealed');
  overlay.classList.remove('show');
  sealed.style.display = '';
}

// ── ANIMATION TRANSITIONS ÉCRANS ────────────────────────
let _prevScreen = null;
const _mainScreens = ['screenRadar','screenMap','screenDeposit','screenProfile'];
const _screenOrder = { screenRadar:0, screenMap:1, screenDeposit:2, screenProfile:3 };

function animateScreenTransition(newId) {
  const el = document.getElementById(newId);
  if (!el) return;
  el.classList.remove('slide-in', 'slide-back');
  const prevOrder = _screenOrder[_prevScreen] ?? -1;
  const newOrder  = _screenOrder[newId] ?? -1;
  if (prevOrder !== -1 && newOrder !== -1 && prevOrder !== newOrder) {
    el.classList.add(newOrder > prevOrder ? 'slide-in' : 'slide-back');
    el.addEventListener('animationend', () => el.classList.remove('slide-in','slide-back'), { once: true });
  } else if (_prevScreen && !_mainScreens.includes(_prevScreen)) {
    // Retour depuis écran secondaire → slide-back
    el.classList.add('slide-back');
    el.addEventListener('animationend', () => el.classList.remove('slide-back'), { once: true });
  } else if (!_mainScreens.includes(newId)) {
    // Aller vers écran secondaire → slide-in
    el.classList.add('slide-in');
    el.addEventListener('animationend', () => el.classList.remove('slide-in'), { once: true });
  }
  _prevScreen = newId;
}

// Patch showScreen pour ajouter les animations
window.showScreen = (id, fromPopstate = false) => {
  // Écrans réservés aux comptes réels — rediriger les anonymes vers l'inscription
  if (_isGuestUser() && (id === 'screenDeposit' || id === 'screenProfile')) {
    _promptSignUp(id === 'screenDeposit' ? 'guest_signup_deposit' : 'guest_signup_profile');
    return;
  }
  // Ping sonar du radar : calé sur .active avant le switch pour ne (re)démarrer
  // qu'en entrant réellement sur le radar (pas sur un re-showScreen redondant
  // pendant qu'on y est déjà), et s'arrêter net dès qu'on le quitte.
  const _wasRadarActive = document.getElementById('screenRadar')?.classList.contains('active');
  animateScreenTransition(id);
  _showScreenBase(id, fromPopstate);
  if (id === 'screenRadar' && !_wasRadarActive) _startRadarPingLoop();
  else if (id !== 'screenRadar' && _wasRadarActive) _stopRadarPingLoop();

  // Bandeau mode invité — visible uniquement sur le radar, disparaît dès que
  // le compte n'est plus anonyme (inscription/liaison de compte), réévalué
  // à chaque navigation donc toujours synchronisé sans écouteur dédié.
  const guestBanner = document.getElementById('guestBanner');
  if (guestBanner) guestBanner.style.display = (id === 'screenRadar' && _isGuestUser()) ? 'flex' : 'none';

  // Affiche/cache la bottom-nav selon l'écran (toujours visible sauf auth/onboarding)
  const nav = document.getElementById('bottomNav');
  const noNavScreens = ['screenAuth', 'screenOnboard'];
  if (nav) {
    if (noNavScreens.includes(id)) {
      nav.style.display = 'none';
      document.body.classList.remove('has-bottom-nav');
    } else {
      nav.style.display = 'flex';
      document.body.classList.add('has-bottom-nav');
    }
  }
};

// ── REPLY CHAR COUNTER ───────────────────────────────────
window.updateReplyCount = (el) => {
  const n = el.value.length;
  const counter = document.getElementById('replyCharCount');
  if (!counter) return;
  counter.textContent = n + ' / 280';
  counter.className = 'reply-char-count' + (n >= 280 ? ' full' : n >= 240 ? ' near' : '');
};

// ── BADGE NAV DÉPOSER ────────────────────────────────────
window.showDepositBadge = () => {
  const b = document.getElementById('depositBadge');
  if (b) b.classList.add('show');
};
window.hideDepositBadge = () => {
  const b = document.getElementById('depositBadge');
  if (b) b.classList.remove('show');
};

// ── PULL TO REFRESH ──────────────────────────────────────
(function initPullToRefresh() {
  let startY = 0, pulling = false, triggered = false;
  const MIN_PULL = 72;

  // #screenRadar n'a pas de wrapper .scroll comme les autres écrans (en-tête
  // fixe) — seule la liste des fantômes défile réellement.
  const getContainer = () => document.querySelector('#screenRadar .ghost-list-wrap');

  document.addEventListener('touchstart', (e) => {
    const container = getContainer();
    if (!container || !document.getElementById('screenRadar').classList.contains('active')) return;
    if (container.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    triggered = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { pulling = false; return; }
    const ind = document.getElementById('ptrIndicator');
    const spinner = document.getElementById('ptrSpinner');
    const txt = document.getElementById('ptrText');
    if (!ind) return;
    if (dy > 20) ind.classList.add('visible');
    // Seuil franchi mais toujours en train de tirer (pas encore relâché) :
    // c'est ICI qu'il faut inviter à relâcher, pas afficher "Actualisation…"
    // (qui ne doit apparaître qu'après le relâchement, une fois le fetch lancé).
    if (dy > MIN_PULL && !triggered) {
      triggered = true;
      if (txt) txt.textContent = t.misc_ptr_release;
    } else if (!triggered && txt) {
      txt.textContent = t.misc_ptr_pull;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const ind = document.getElementById('ptrIndicator');
    const spinner = document.getElementById('ptrSpinner');
    const txt = document.getElementById('ptrText');
    if (triggered) {
      // Relâché : c'est maintenant que le spinner tourne et que le texte
      // passe à "Actualisation…", pendant le fetch réel.
      if (spinner) spinner.classList.add('spin');
      if (txt) txt.textContent = t.misc_ptr_refreshing;
      loadNearbyGhosts().finally(() => {
        if (ind) ind.classList.remove('visible');
        if (spinner) spinner.classList.remove('spin');
        if (txt) txt.textContent = t.misc_ptr_pull;
      });
    } else {
      if (ind) ind.classList.remove('visible');
    }
  });
})();

// ── SWIPE TO CLOSE BOTTOM SHEETS ────────────────────────
(function initSwipeClose() {
  ['reportModal','shareModal'].forEach(modalId => {
    let startY = 0, isDragging = false;
    const getSheet = () => document.querySelector(`#${modalId} .report-sheet, #${modalId} .share-sheet`);

    document.addEventListener('touchstart', (e) => {
      const modal = document.getElementById(modalId);
      if (!modal?.classList.contains('show')) return;
      const handle = e.target.closest('.sheet-handle');
      if (!handle) return;
      startY = e.touches[0].clientY;
      isDragging = true;
      const sheet = getSheet();
      if (sheet) sheet.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0) return;
      const sheet = getSheet();
      if (sheet) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const dy = e.changedTouches[0].clientY - startY;
      const sheet = getSheet();
      if (sheet) sheet.style.transition = '';
      if (dy > 100) {
        if (modalId === 'reportModal') closeReportModal();
        else closeModal('shareModal');
      } else {
        if (sheet) sheet.style.transform = '';
      }
    });
  });
})();

// ── HAPTIC FEEDBACK ──────────────────────────────────────
function haptic(pattern = [10]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Ajout haptic sur les éléments clés
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item')) haptic([8]);
  if (e.target.closest('.btn-primary, .wizard-next-btn')) haptic([12]);
  if (e.target.closest('.ghost-envelope')) haptic([15]);
});

// ── TOOLTIPS [data-tip] — fermeture tactile ──────────────
// [data-tip]::after ne s'affichait qu'en CSS pur (:hover/:focus). Sur mobile,
// un tap simule un :hover/:focus "collant" qui ne se relâche jamais (pas de
// vrai mouseleave/blur tactile) — la bulle restait affichée en permanence
// (confirmé y compris en émulation tactile Playwright). CSS ne peut plus
// déclencher l'affichage (cf. règle [data-tip].tip-show::after dans
// index.html) : c'est entièrement piloté ici via une classe .tip-show —
// apparaît au tap/clic/focus clavier sur l'élément (ou un enfant, ex. les
// boutons dans .radar-radius-selector), se referme après un court délai, ou
// immédiatement au tap ailleurs sur l'écran.
const TIP_AUTO_HIDE_MS = 2200;
function _showTip(tipEl) {
  document.querySelectorAll('.tip-show').forEach(el => {
    if (el !== tipEl) { el.classList.remove('tip-show'); clearTimeout(el._tipTimer); }
  });
  if (tipEl) {
    tipEl.classList.add('tip-show');
    clearTimeout(tipEl._tipTimer);
    tipEl._tipTimer = setTimeout(() => tipEl.classList.remove('tip-show'), TIP_AUTO_HIDE_MS);
  }
}
document.addEventListener('click', (e) => _showTip(e.target.closest('[data-tip]')));
// focusin (contrairement à focus) bubble — nécessaire pour la navigation clavier
document.addEventListener('focusin', (e) => {
  const tipEl = e.target.closest('[data-tip]');
  if (tipEl) _showTip(tipEl);
});

// ── GESTE RETOUR (glisser depuis le bord gauche) ─────────
(function initEdgeSwipeBack() {
  let startX = 0, startY = 0, tracking = false;
  const BACK_SCREENS = ['screenDetail','screenReply'];

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = startX < 30; // zone bord gauche
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;
    if (dx > 80 && dy < 60 && BACK_SCREENS.includes(activeScreen.id)) {
      haptic([10]);
      history.back();
    }
  });
})();

// ── BADGE : afficher si de nouveaux fantômes détectés ───
let _lastGhostCount = 0;
function checkForNewGhosts(newCount) {
  if (_lastGhostCount > 0 && newCount > _lastGhostCount) {
    const diff = newCount - _lastGhostCount;
    const b = document.getElementById('depositBadge');
    // On montre plutôt sur le radar, mais on peut signaler
    showToast('info', t.radar_new_ghost.replace('{n}', diff).replace('{x}', diff>1?'x':'').replace('{s}', diff>1?'s':''));
  }
  _lastGhostCount = newCount;
}

// ── INPUT : effacer erreur à la frappe ───────────────────
document.addEventListener('input', (e) => {
  if (e.target.closest('#tabLogin')) {
    document.getElementById('loginAuthError').textContent = '';
  }
  if (e.target.closest('#tabRegister')) {
    document.getElementById('regAuthError').textContent = '';
  }
  // Border reset
  if (e.target.classList.contains('form-input') || e.target.classList.contains('form-textarea')) {
    e.target.style.borderColor = '';
  }
});

// ── AUTO-RESIZE TEXTAREA ─────────────────────────────────
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.tagName === 'TEXTAREA' && el.id === 'depositMsg') {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }
});

// ── INDICATEUR DE CHARGEMENT GLOBAL ─────────────────────
function setLoading(btn, loading, defaultText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.origText = btn.textContent;
    btn.textContent = '';
    btn.classList.add('btn-loading');
  } else {
    btn.disabled = false;
    btn.textContent = defaultText || btn.dataset.origText || btn.textContent;
    btn.classList.remove('btn-loading');
  }
}
window.setLoading = setLoading;

window.setNav = (id) => {
  // Si on switch vers un autre onglet, vibration légère (feedback tactile)
  const current = document.querySelector('.nav-item.active');
  const isSwitch = current && current.id !== id;
  if (isSwitch) {
    try { window.HapticsService?.tap?.(); } catch(_) { console.warn('[ghostub:setNav:haptic]', _); }
  }
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.setAttribute('aria-current', 'false');
  });
  if (id) {
    document.getElementById(id)?.classList.add('active');
    document.getElementById(id)?.setAttribute('aria-current', 'page');
  }
};

window.showTab = (tab) => {
  ['tabLogin','tabRegister'].forEach(id => {
    const el = document.getElementById(id);
    el.style.opacity = '0';
    el.style.display = 'none';
  });
  const target = document.getElementById(tab === 'login' ? 'tabLogin' : 'tabRegister');
  target.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => { target.style.opacity = '1'; }));
  document.getElementById('tabLogin').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('tabRegister').style.display = tab === 'register' ? 'flex' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).setAttribute('aria-selected', 'true');
  document.getElementById('loginAuthError').textContent = '';
  document.getElementById('regAuthError').textContent = '';
};

// ── REVERSE GEOCODING ───────────────────────────────────
const _geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`; // précision ~110m
  if (_geocodeCache[key] !== undefined) return _geocodeCache[key];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`, {
      headers: { 'User-Agent': 'GhostubApp/1.0' }
    });
    const data = await res.json();
    const addr = data.address || {};
    // Priorité : café/bar/restaurant > rue > quartier > ville
    const result = addr.amenity || addr.shop || addr.tourism || addr.leisure ||
           (addr.road ? (addr.house_number ? addr.road + ' ' + addr.house_number : addr.road) : null) ||
           addr.neighbourhood || addr.suburb || addr.city_district ||
           addr.town || addr.city || null;
    _geocodeCache[key] = result;
    return result;
  } catch(e) { return null; }
}

// ── DEPOSIT MINI-MAP ─────────────────────────────────────
let _depositMiniMap = null;
let _depositRadiusCircle = null;
let _depositMiniMapAttempts = 0;

// Si pas de GPS encore, on attend ou on demande
function _handleMiniMapNoGPS(loader) {
  console.warn('[MiniMap] ⚠️ Pas de GPS — userLat/Lng vides');
  _depositMiniMapAttempts = (_depositMiniMapAttempts || 0) + 1;
  if (loader) loader.textContent = '📡 Localisation…';
  // Tenter de récupérer la position si on ne l'a pas
  if (typeof getLocation === 'function' && _depositMiniMapAttempts === 1) {
    getLocation().then(() => {
      // Une fois reçu, retry l'init
      setTimeout(() => _initDepositMiniMap(), 100);
    }).catch(() => {
      // Pas de GPS dispo → afficher message clair, ne pas bloquer le wizard
      if (loader) {
        loader.textContent = (typeof _currentLang !== 'undefined' && _currentLang === 'en')
          ? '📍 Location unavailable'
          : '📍 Géolocalisation indisponible';
      }
    });
  } else if (_depositMiniMapAttempts < 5) {
    // Retry périodique (max 5 fois sur 10 secondes)
    setTimeout(() => _initDepositMiniMap(), 2000);
  } else {
    // Abandon : on cache le loader pour ne pas rester bloqué
    if (loader) {
      loader.textContent = (typeof _currentLang !== 'undefined' && _currentLang === 'en')
        ? '📍 Location unavailable'
        : '📍 Géolocalisation indisponible';
    }
  }
}

// Invalider si déjà initialisé (retour arrière). Vérification robuste :
// Leaflet doit pointer vers le BON container DOM, sinon on détruit pour
// recréer (cas où le DOM a été ré-rendu). Retourne true si la carte
// existante a été réutilisée (le caller doit alors sortir), false si elle
// a été détruite (ou n'existait pas) et qu'il faut en reconstruire une.
function _reuseOrResetDepositMiniMap(container, loader) {
  if (!_depositMiniMap) return false;

  const linkedContainer = _depositMiniMap.getContainer && _depositMiniMap.getContainer();
  const isStillValid = linkedContainer === container && container.isConnected;
  if (isStillValid) {
    _depositMiniMap.invalidateSize();
    _depositMiniMap.setView([userLat, userLng], 17);
    _updateRadiusCircle();
    if (loader) loader.style.display = 'none';
    // Re-invalidation après transitions CSS pour cas où le container a été masqué/affiché
    setTimeout(() => {
      if (_depositMiniMap) try { _depositMiniMap.invalidateSize(); } catch(_) { console.warn('[ghostub:_initDepositMiniMap:invalidate]', _); }
    }, 350);
    return true;
  }

  // Container changé ou détaché → on détruit pour recréer proprement
  try { _depositMiniMap.remove(); } catch(_) { console.warn('[ghostub:_initDepositMiniMap:reset]', _); }
  _depositMiniMap = null;
  _depositRadiusCircle = null;
  // Vider le container au cas où Leaflet a laissé des résidus
  container.innerHTML = '';
  return false;
}

// Charge Leaflet dynamiquement si pas encore disponible et relance l'init
// une fois prêt. Retourne true si Leaflet est déjà chargé (le caller doit
// continuer), false si un chargement async a été déclenché (le caller doit
// sortir — _initDepositMiniMap() sera rappelée par le listener 'load').
function _ensureLeafletForMiniMap(loader) {
  if (typeof L !== 'undefined') return true;

  console.warn('[MiniMap] Leaflet pas encore chargé — chargement dynamique...');
  if (loader) {
    loader.style.display = 'flex';
    loader.textContent = (typeof _currentLang !== 'undefined' && _currentLang === 'en')
      ? '⏳ Loading map…'
      : '⏳ Chargement de la carte…';
  }
  // Charger CSS Leaflet si pas déjà fait
  if (!document.getElementById('leafletCSS')) {
    const css = document.createElement('link');
    css.id = 'leafletCSS';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }
  // Charger script Leaflet si pas déjà en cours
  let script = document.getElementById('leafletScript');
  if (!script) {
    script = document.createElement('script');
    script.id = 'leafletScript';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);
  }
  // Attendre le chargement puis re-tenter l'init
  script.addEventListener('load', () => {
    console.log('[MiniMap] ✅ Leaflet chargé, re-init...');
    _initDepositMiniMap();
  }, { once: true });
  script.addEventListener('error', () => {
    console.error('[MiniMap] ❌ Échec chargement Leaflet');
    if (loader) {
      loader.textContent = (typeof _currentLang !== 'undefined' && _currentLang === 'en')
        ? '⚠️ Could not load map'
        : '⚠️ Impossible de charger la carte';
    }
  }, { once: true });
  return false;
}

function _buildDepositMiniMapInstance(loader) {
  _depositMiniMap = L.map('depositMiniMap', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false
  }).setView([userLat, userLng], 17);

  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OSM France'
  }).addTo(_depositMiniMap);

  // Cacher le loader dès qu'une tuile charge
  let _tileLoaded = false;
  tileLayer.on('tileload', () => {
    _tileLoaded = true;
    console.log('[MiniMap] ✅ Tuile chargée');
    if (loader) loader.style.display = 'none';
  });
  tileLayer.on('tileerror', (e) => {
    console.warn('[MiniMap] ❌ Erreur chargement tuile', e?.tile?.src || '');
    if (loader) loader.style.display = 'none';
  });
  // Fallback ultime : cacher le loader après 2s quoi qu'il arrive
  setTimeout(() => { if (loader) loader.style.display = 'none'; }, 2000);
  // Si vraiment AUCUNE tuile chargée après 4s → afficher message d'erreur clair
  setTimeout(() => {
    if (!_tileLoaded && loader) {
      console.error('[MiniMap] ❌ AUCUNE tuile chargée après 4s — vérifier réseau/CSP/adblocker');
      loader.style.display = 'flex';
      loader.textContent = (typeof _currentLang !== 'undefined' && _currentLang === 'en')
        ? '⚠️ Map unavailable (network blocked?)'
        : '⚠️ Carte indisponible (réseau bloqué ?)';
      loader.style.background = 'rgba(40,10,10,.85)';
      loader.style.color = 'rgba(255,150,150,.9)';
    }
  }, 4000);

  // Marqueur position — version originale, simple et fiable
  L.marker([userLat, userLng], {
    icon: L.divIcon({
      html: '<div class="dep-mini-map-user-dot"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: ''
    })
  }).addTo(_depositMiniMap);

  _updateRadiusCircle();
  if (loader) loader.style.display = 'none';

  // Re-invalidation après transitions CSS (le container peut avoir été redimensionné)
  setTimeout(() => {
    if (_depositMiniMap) {
      try { _depositMiniMap.invalidateSize(); } catch(_) { console.warn('[ghostub:_initDepositMiniMap:invalidate]', _); }
    }
  }, 350);
}

function _initDepositMiniMap() {
  const loader = document.getElementById('depositMiniLoader');
  const container = document.getElementById('depositMiniMap');

  // ── DIAGNOSTIC v98 — visible dans console F12 ──
  console.log('[MiniMap] init appelé', {
    container: !!container,
    containerSize: container ? `${container.offsetWidth}x${container.offsetHeight}` : 'no-container',
    userLat,
    userLng,
    leafletLoaded: typeof L !== 'undefined',
    alreadyInit: !!_depositMiniMap,
    loader: !!loader
  });

  if (!container) {
    console.warn('[MiniMap] ❌ container #depositMiniMap absent du DOM');
    return;
  }

  if (!userLat || !userLng) { _handleMiniMapNoGPS(loader); return; }

  // GPS dispo : reset compteur
  _depositMiniMapAttempts = 0;

  if (_reuseOrResetDepositMiniMap(container, loader)) return;

  if (!_ensureLeafletForMiniMap(loader)) return;

  _buildDepositMiniMapInstance(loader);
}

function _updateRadiusCircle() {
  if (!_depositMiniMap || !userLat || !userLng) return;
  const activeBtn = document.querySelector('.radius-btn.active');
  const radiusStr = activeBtn ? activeBtn.textContent : '10m';
  const radiusM = Math.max(3, parseInt(radiusStr) || 10);

  if (_depositRadiusCircle) _depositMiniMap.removeLayer(_depositRadiusCircle);
  _depositRadiusCircle = L.circle([userLat, userLng], {
    radius: radiusM,
    color: 'rgba(var(--ghost-blue-rgb),.8)',
    fillColor: 'rgba(var(--ghost-blue-rgb),.12)',
    fillOpacity: 1,
    weight: 1.5
  }).addTo(_depositMiniMap);

  // Zoom adapté au rayon
  const zoom = radiusM <= 3 ? 19 : radiusM <= 10 ? 18 : 17;
  _depositMiniMap.setView([userLat, userLng], zoom);
}

window._selectRadius = (btn) => {
  selectType(btn);           // comportement existant inchangé
  _updateRadiusCircle();     // mise à jour du cercle
};

function setWizardStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById('wizardStep' + i).style.display = i === n ? 'block' : 'none';
    const ws = document.getElementById('ws' + i);
    ws.classList.remove('active','done');
    if (i === n) ws.classList.add('active');
    else if (i < n) ws.classList.add('done');
    ws.setAttribute('aria-current', i === n ? 'step' : 'false');
  });
  [1,2,3].forEach(i => {
    const dot = document.querySelector('#ws' + i + ' .wizard-step-dot');
    if (dot) dot.textContent = i < n ? '✓' : String(i);
  });
  document.querySelector('#screenDeposit .scroll').scrollTop = 0;
  if (n === 2) setTimeout(_initDepositMiniMap, 80);
  if (n === 3) updatePremiumUI(); // Basculer aperçu/contenu Premium à l'affichage de l'étape 3
}

window.pickEmoji = (el, emoji) => {
  document.querySelectorAll('.emoji-opt').forEach(e => {
    e.classList.remove('active');
    e.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
  document.getElementById('depositEmoji').value = emoji;
};

window.pickEmojiCustom = (input) => {
  document.querySelectorAll('.emoji-opt:not(.emoji-custom)').forEach(e => e.classList.remove('active'));
};

document.addEventListener('DOMContentLoaded', () => {
  const emojiInput = document.getElementById('depositEmoji');
  if (emojiInput && !emojiInput.value) emojiInput.value = '👻';

  const msg = document.getElementById('depositMsg');
  if (msg) {
    msg.addEventListener('input', () => {
      const len = msg.value.length;
      const counter = document.getElementById('msgCharCount');
      if (counter) {
        counter.textContent = len;
        const parent = counter.parentElement;
        parent.classList.remove('near','full');
        if (len > 540) parent.classList.add('full');
        else if (len > 450) parent.classList.add('near');
      }
    });
  }

  // Init offline check
  updateOnlineStatus();
});

window.selectType = (el) => {
  el.parentElement.querySelectorAll('.type-btn,.radius-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
};

window.selectDur = (el) => {
  el.parentElement.querySelectorAll('.dur-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
};

window.selectMaxOpen = (el) => {
  const val = parseInt(el.dataset.maxopen || '0');
  if (val > 1 && !isPremium) {
    showToast('warning', t.dep_maxopen_locked, 4000);
    return;
  }
  el.parentElement.querySelectorAll('.dur-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
};

function _updateMaxOpenLockUI() {
  ['maxOpen5Btn', 'maxOpen10Btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('locked', !isPremium);
    // Un compte redevenu gratuit ne doit pas garder 5/10 sélectionné
    if (!isPremium && btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
      const oneBtn = btn.parentElement.querySelector('.dur-btn[data-maxopen="1"]');
      if (oneBtn) { oneBtn.classList.add('active'); oneBtn.setAttribute('aria-pressed', 'true'); }
      if (typeof _updateMaxOpenAccordionSummary === 'function') _updateMaxOpenAccordionSummary();
    }
  });
}

// ── ONBOARDING CAROUSEL ─────────────────
let obCurrentScene = 0;
const OB_TOTAL = 4;

function goObScene(n) {
  const scenes = document.querySelectorAll('.ob-scene');
  const dots   = document.querySelectorAll('.ob-dot');
  scenes[obCurrentScene].classList.remove('active');
  scenes[obCurrentScene].classList.add('exit');
  scenes[obCurrentScene].setAttribute('aria-hidden', 'true');
  setTimeout(() => scenes[obCurrentScene].classList.remove('exit'), 450);
  obCurrentScene = n;
  scenes[n].classList.add('active');
  scenes[n].setAttribute('aria-hidden', 'false');
  dots.forEach((d,i) => {
    d.classList.toggle('active', i === n);
    d.setAttribute('aria-current', i === n ? 'true' : 'false');
  });
  const cta = document.getElementById('obCta');
  const hint = document.getElementById('obSwipeHint');
  if (n === OB_TOTAL - 1) {
    cta.classList.add('visible');
    if (hint) hint.style.display = 'none';
  } else {
    cta.classList.remove('visible');
    if (hint) hint.style.display = '';
  }
  if (n === 3) spawnObParticles();
}
window.goObScene = goObScene;

function spawnObParticles() {
  const wrap = document.getElementById('obResoParticles');
  if (!wrap) return;
  wrap.innerHTML = '';
  // 'mark' remplace l'ancien emoji 👻 brut par le mark "Trace" (cf. _BRAND_MARK_HTML)
  const syms = ['✦','✧','·','mark','✦','✦'];
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.className = 'ob-reso-p';
    p.setAttribute('aria-hidden', 'true');
    const angle = (i / 10) * 2 * Math.PI;
    const dist = 50 + Math.random() * 40;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist - 20 + 'px');
    p.style.setProperty('--d', (1 + Math.random()).toFixed(1) + 's');
    p.style.setProperty('--delay', (i * 0.15).toFixed(2) + 's');
    // opacity (pas color) : s'applique aussi bien au texte qu'au mark SVG ci-dessous
    p.style.color = 'rgba(var(--ghost-blue-rgb),1)';
    p.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    const sym = syms[i % syms.length];
    if (sym === 'mark') {
      p.innerHTML = '<img src="assets/brand/ghostub-mark-trace.svg" class="ob-particle-mark-icon" aria-hidden="true">';
    } else {
      p.textContent = sym;
    }
    wrap.appendChild(p);
  }
}

(function() {
  let ox = 0;
  const el = document.getElementById('screenOnboard');
  if (!el) return;
  el.addEventListener('touchstart', e => { ox = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - ox;
    if (Math.abs(dx) > 40) {
      const next = obCurrentScene + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < OB_TOTAL) goObScene(next);
    }
  }, {passive:true});
})();

// ── HOLD-TO-BREAK : maintenir pour briser le sceau ─────────────
let _holdTimer = null;
let _holdStart = null;
let _holdRaf = null;
const HOLD_DURATION = 1400; // ms

window.startSealHold = (e) => {
  e.preventDefault();
  if (_holdTimer) return;
  _holdStart = Date.now();
  const btn = document.getElementById('envelopeOpenBtn');
  const bar = document.getElementById('sealHoldBar');
  if (bar) { bar.style.width = '0%'; bar.style.opacity = '1'; }
  if (btn) btn.classList.add('holding');

  // Son crescendo
  const actx = _getAudioCtx();
  let _holdOsc = null, _holdGain = null;
  if (actx) {
    try {
      _holdOsc = actx.createOscillator();
      _holdGain = actx.createGain();
      _holdOsc.type = 'sine';
      _holdOsc.frequency.setValueAtTime(220, actx.currentTime);
      _holdOsc.frequency.exponentialRampToValueAtTime(440, actx.currentTime + HOLD_DURATION / 1000);
      _holdGain.gain.setValueAtTime(0.001, actx.currentTime);
      _holdGain.gain.linearRampToValueAtTime(0.07, actx.currentTime + HOLD_DURATION / 1000);
      _holdOsc.connect(_holdGain); _holdGain.connect(actx.destination);
      _holdOsc.start();
    } catch(e) { console.warn('[ghostub:startSealHold:audio]', e); }
  }

  const tick = () => {
    const elapsed = Date.now() - _holdStart;
    const pct = Math.min(elapsed / HOLD_DURATION * 100, 100);
    if (bar) bar.style.width = pct + '%';
    if (elapsed >= HOLD_DURATION) {
      _clearHold();
      if (_holdOsc) { try { _holdOsc.stop(); } catch(e){ console.warn('[ghostub:sealHold:stopOsc]', e); } }
      if (bar) { bar.style.opacity = '0'; bar.style.width = '100%'; }
      openEnvelope();
    } else {
      _holdRaf = requestAnimationFrame(tick);
    }
  };
  _holdRaf = requestAnimationFrame(tick);

  // Stocker l'osc pour annulation
  btn._holdOsc = _holdOsc;
};

window.cancelSealHold = () => {
  if (!_holdStart) return;
  const btn = document.getElementById('envelopeOpenBtn');
  const bar = document.getElementById('sealHoldBar');
  if (btn) {
    if (btn._holdOsc) { try { btn._holdOsc.stop(); } catch(e){ console.warn('[ghostub:cancelSealHold:stopOsc]', e); } btn._holdOsc = null; }
    btn.classList.remove('holding');
  }
  if (bar) { bar.style.opacity = '0'; bar.style.width = '0%'; }
  _clearHold();
};

function _clearHold() {
  _holdStart = null;
  if (_holdRaf) { cancelAnimationFrame(_holdRaf); _holdRaf = null; }
  if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
  const btn = document.getElementById('envelopeOpenBtn');
  if (btn) btn.classList.remove('holding');
}

window.goAuth = () => { localStorage.setItem('ghostub_onboard_seen', '1'); showScreen('screenAuth'); };

function createParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const COLORS = [[232,160,48],[122,184,245],[61,184,122]]; // amber, spirit, mist
  const COUNT = 35;
  let W, H;

  function resize() {
    W = canvas.parentElement.offsetWidth || window.innerWidth;
    H = canvas.parentElement.offsetHeight || window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -(Math.random() * 0.3 + 0.1),
      a: Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2,
      col: COLORS[Math.floor(Math.random() * 3)]
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const t = performance.now() * 0.001;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      const alpha = p.a * (0.5 + 0.5 * Math.sin(t * 0.8 + p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}
createParticles();

// ── Bruine nocturne ─────────────────────────────────────
(function createRain() {
  const container = document.getElementById('cityRain');
  if (!container) return;
  const COUNT = 28;
  for (let i = 0; i < COUNT; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    const h = 8 + Math.random() * 18;
    drop.style.cssText = [
      'left:' + (Math.random() * 100) + '%',
      'height:' + h + 'px',
      'animation-duration:' + (1.2 + Math.random() * 1.8) + 's',
      'animation-delay:' + (Math.random() * 3) + 's',
      'opacity:' + (0.15 + Math.random() * 0.35)
    ].join(';');
    container.appendChild(drop);
  }
})();

// Initialiser les boutons langue
document.querySelectorAll('.lang-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.lang === _currentLang);
});

// Fermer openLimitModal au clic fond
document.addEventListener('click', (e) => {
  const modal = document.getElementById('openLimitModal');
  if (modal?.classList.contains('show') && e.target === modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// ── MODE EXPLORATION ANONYME ─────────────────────────────
window.guestExplore = async () => {
  // Si l'auth anonyme silencieuse a déjà réussi, currentUser est déjà anonyme.
  // signInAnonymously() retournerait le même user SANS déclencher onAuthStateChanged
  // → aucune navigation. On navigue directement.
  if (currentUser && currentUser.isAnonymous) {
    showScreen('screenRadar');
    setNav('nav-radar');
    // Premier passage : le GPS n'a pas encore démarré (voir onAuthStateChanged,
    // qui l'évite pendant screenOnboard) — on le déclenche maintenant que le
    // radar est affiché.
    await _ensureLocationReady();
    await loadNearbyGhosts();
    return;
  }
  // Pas encore d'utilisateur (auth silencieuse échouée) — nouvel essai
  try {
    await signInAnonymously(auth);
    // onAuthStateChanged gère la navigation vers screenRadar
  } catch(e) {
    console.warn('[ghostub:guestExplore]', e);
    showScreen('screenRadar'); setNav('nav-radar');
    showToast('info', '🌫️ Mode exploration — connecte-toi pour déposer', 3500);
  }
};

// ══════════════════════════════════════════════════════════
// DISPATCHER D'ÉVÉNEMENTS DÉLÉGUÉ (retrait de unsafe-inline, audit 4.6)
// Remplace les attributs onclick/onkeydown/onchange/oninput inline (interdits
// une fois 'unsafe-inline' retiré de script-src — GitHub Pages ne peut pas
// générer de nonce par requête) par une délégation unique sur document.
// Chaque élément interactif porte data-action="nomAction" (+ des data-*
// pour ses arguments variables) ; ACTIONS est une whitelist explicite plutôt
// qu'une résolution dynamique via window[name] — toute action déclenchable
// depuis le markup reste visible ici en un coup d'œil, plus sûr et plus
// auditable qu'un lookup générique.
//
// Convention data-* par type d'action :
//   data-action        → un seul argument variable : lu dans data-arg
//   data-action="nav"  → navigation générique (remplace tous les
//                         showScreen('x');setNav('y')[;extra()] enchaînés) :
//                         data-screen, data-nav (optionnel), data-extra
//                         (optionnel, seule valeur actuelle : "hideDepositBadge")
//   data-enter-action  → uniquement sur Entrée (jamais Espace), pour les
//                         champs texte où Entrée valide (login, register…)
//   data-change-action / data-input-action → événements change/input,
//                         l'élément lui-même est passé (équivalent de `this`)
// ══════════════════════════════════════════════════════════
const ACTIONS = {
  // Navigation écran générique — voir convention ci-dessus.
  nav: (el) => {
    const screen = el.dataset.screen;
    const navId = el.dataset.nav;
    if (screen) showScreen(screen);
    if (navId) setNav(navId);
    if (el.dataset.extra === 'hideDepositBadge') hideDepositBadge();
  },
  goBack: () => history.back(),

  // Zone 1 — Onboard/Intro
  goAuth: () => goAuth(),
  goObScene: (el) => goObScene(Number(el.dataset.arg)),

  // Zone 2 — Auth (login/register)
  showTab: (el) => showTab(el.dataset.arg),
  login: () => login(),
  register: () => register(),
  forgotPassword: () => forgotPassword(),
  togglePasswordVisibility: (el) => togglePasswordVisibility(el.dataset.id, el),
  guestExplore: () => guestExplore(),

  // Zone 3 — nav du bas + modales partagées
  closeShareModal: (el, event) => closeShareModal(event),
  copyShareLink: () => copyShareLink(),
  nativeShare: () => nativeShare(),
  closeModal: (el) => closeModal(el.dataset.arg),
  closeReportModal: (el, event) => closeReportModal(event),
  submitReport: (el) => submitReport(el.dataset.arg),
  dismissGeoPrimer: (el) => _dismissGeoPrimer(el.dataset.arg === 'true'),

  // Zone 4 — Radar
  toggleAudioEnabled: () => toggleAudioEnabled(),
  setRadarRadius: (el) => setRadarRadius(Number(el.dataset.arg)),
  setFilter: (el) => setFilter(el.dataset.arg, el),
  loadNearbyGhosts: () => loadNearbyGhosts(),
  openGhost: (el) => openGhost(el.dataset.id),

  // Zone 5 — Detail + Reply
  swipeGhost: (el) => swipeGhost(Number(el.dataset.arg)),
  openEnvelope: () => openEnvelope(),
  openReportModal: () => openReportModal(),
  resonate: () => resonate(),
  sendQuickReaction: (el) => sendQuickReaction(el.dataset.arg, el),
  sendMicroReply: () => sendMicroReply(),
  toggleFavorite: () => toggleFavorite(),
  generateGhostCard: () => generateGhostCard(),
  openShareModal: () => openShareModal(),
  updateReplyCount: (el) => updateReplyCount(el),
  selectType: (el) => selectType(el),
  sendReply: () => sendReply(),

  // Zone 6 — Deposit
  pickEmoji: (el) => pickEmoji(el, el.dataset.arg),
  pickEmojiCustom: (el) => pickEmojiCustom(el),
  toggleAnonMode: (el) => toggleAnonMode(el),
  toggleBizTypeAccordion: () => toggleBizTypeAccordion(),
  toggleRadiusAccordion: () => toggleRadiusAccordion(),
  selectRadius: (el) => _selectRadius(el),
  toggleDurAccordion: () => toggleDurAccordion(),
  selectDur: (el) => selectDur(el),
  toggleMaxOpenAccordion: () => toggleMaxOpenAccordion(),
  selectMaxOpen: (el) => selectMaxOpen(el),
  toggleCondAccordion: () => toggleCondAccordion(),
  selectCond: (el) => selectCond(el),
  setChainMarker: () => setChainMarker(),
  toggleMediaMenu: () => toggleMediaMenu(),
  selectMediaType: (el) => selectMediaType(el.dataset.arg),
  toggleRecording: () => toggleRecording(),
  triggerPhotoCamera: () => triggerPhotoCamera(),
  triggerPhotoGallery: () => triggerPhotoGallery(),
  handlePhoto: (el) => handlePhoto(el),
  handleVideo: (el) => handleVideo(el),
  handleAttachments: (el) => handleAttachments(el),
  depositGhost: () => depositGhost(),
  toggleBusinessMode: () => toggleBusinessMode(),

  // Zone 7 — Map
  shareMapLocation: () => shareMapLocation(),
  toggleHuntMode: () => toggleHuntMode(),
  setMapFilter: (el) => setMapFilter(el.dataset.arg, el),
  closeMapSheet: (el, event) => closeMapSheet(event),
  mapSheetAction: () => _mapSheetAction(),
  renderStaticMap: () => renderStaticMap(),

  // Zone 8 — Profile
  shareMyProfile: () => shareMyProfile(),
  generateYearCard: () => generateYearCard(),
  shareEmpreinte: () => shareEmpreinte(),
  startStripeCheckout: (el) => startStripeCheckout(el.dataset.arg),
  activatePremium: () => activatePremium(),
  toggleTheme: () => toggleTheme(),
  enableNotifications: () => enableNotifications(),
  setLang: (el) => setLang(el.dataset.arg),
  exportMyData: () => exportMyData(),
  logout: () => logout(),
  deleteMyGhosts: () => deleteMyGhosts(),
  toggleDepositedList: () => toggleDepositedList(),
  toggleDiscoveryHistory: () => toggleDiscoveryHistory(),
  toggleFavoritesList: () => toggleFavoritesList(),
  toggleLeaderboard: () => toggleLeaderboard(),
  removeFavorite: (el) => removeFavorite(el.dataset.id),
  toggleCarnetEntry: (el) => toggleCarnetEntry(el.dataset.id, el.dataset.reactions === 'true', el),
  deleteOneGhost: (el) => deleteOneGhost(el.dataset.id),
  closePublicProfileModal: () => document.getElementById('publicProfileModal').remove(),
  joinGhostub: () => { window.location.href = 'https://pimpimshop33-dotcom.github.io/ghostub/'; },
  renewBusinessGhost: (el) => renewBusinessGhost(el.dataset.id),

  // Zone 10 — reste (bannières, toasts, notifications)
  applyUpdate: () => applyUpdate(),
  requestSuccessNotif: (el, event) => _requestSuccessNotif(event),
  setTraceColor: (el) => setTraceColor(el.dataset.arg),
  clearAudio: () => clearAudio(),
  clearPhoto: () => clearPhoto(),
  clearVideo: () => clearVideo(),
  removeAttachment: (el) => removeAttachment(Number(el.dataset.arg)),
  triggerVideo: () => triggerVideo(),
  triggerAttachments: () => triggerAttachments(),
  followChain: () => followChain(),
  copyDedicatedLink: () => navigator.clipboard.writeText(window._lastDedicatedLink).then(() => showToast('link', 'Lien copié !')),
};

function _dispatchAction(el, event) {
  const name = el.dataset.action;
  const fn = ACTIONS[name];
  if (!fn) { console.warn('[ghostub:dispatch] action inconnue:', name); return; }
  fn(el, event);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) _dispatchAction(el, e);
});

// Entrée/Espace sur un élément data-action focusable au clavier (tabindex="0"
// — remplace les onkeydown="if(event.key==='Enter'||event.key===' ')fn()" du
// markup, qu'il porte role="button" (nav, accordéons) ou un autre rôle comme
// role="listitem" (report-reason). Un <button> natif gère déjà Entrée/Espace
// nativement, donc exclu ici pour ne pas déclencher l'action deux fois.
// Entrée seule (jamais Espace, qui doit rester une espace tapée) sur
// data-enter-action pour les champs texte.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const el = e.target.closest('[data-action][tabindex="0"]');
    if (el && el.tagName !== 'BUTTON') {
      e.preventDefault();
      _dispatchAction(el, e);
      return;
    }
  }
  if (e.key === 'Enter') {
    const enterEl = e.target.closest('[data-enter-action]');
    if (enterEl) {
      const fn = ACTIONS[enterEl.dataset.enterAction];
      if (fn) fn(enterEl, e);
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change-action]');
  if (el) {
    const fn = ACTIONS[el.dataset.changeAction];
    if (fn) fn(el, e);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input-action]');
  if (el) {
    const fn = ACTIONS[el.dataset.inputAction];
    if (fn) fn(el, e);
  }
});

