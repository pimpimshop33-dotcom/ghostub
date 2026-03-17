import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp, GeoPoint, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import WorldService, { buildGeohashFields, encodeGeohash } from './services/world.service.js?v=2';
import GhostService from './services/ghost.service.js';
import LocationService from './services/location.service.js';

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
    // Radar
    radar_locating: 'Localisation en cours…',
    radar_searching: '🔍 Recherche de fantômes…',
    radar_no_gps: 'Géolocalisation refusée — activez-la dans les paramètres de votre navigateur.',
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
    detail_share_ghost_btn: '↗ Partager ce fantôme',
    detail_reply_ghost_btn: '↩ Laisser une réponse ici',
    dep_back: '← Retour',
    detail_sealed_hint: 'Approchez-vous pour briser le sceau',
    detail_of_anon: 'De 👻 Anonyme · ',
    detail_of: 'De ',
    detail_from_you: 'de vous',
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
    detail_first_reader: '🥇 Vous êtes le premier à lire ce message',
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
    env_gps_denied: '⚠️ GPS indisponible — activez-le et réessayez en extérieur.',
    env_resist: '🌫️ Le sceau résiste encore',
    env_resist_dist: 'encore {n}m à parcourir',
    env_hint_reset: 'Approchez-vous pour briser le sceau',
    // Deposit
    dep_title: 'Déposer',
    dep_msg_placeholder: 'Laissez un message à cet endroit…',
    dep_loc_placeholder: 'Nom du lieu (rue, café, parc…)',
    dep_loc_searching: 'Recherche du lieu…',
    dep_emoji_placeholder: 'Emoji (👻)',
    dep_btn: '👻 Ancrer ce fantôme',
    dep_btn_upload: '⬆ Upload…',
    dep_btn_saving: '✓ Upload · Sauvegarde…',
    dep_success: '👻 Votre trace est ancrée dans ce lieu…',
    dep_err_msg: 'Écrivez un message.',
    dep_err_long: 'Message trop long (280 caractères max).',
    dep_err_gps: 'Géolocalisation requise — activez-la dans votre navigateur.',
    dep_err_offline: 'Vous êtes hors ligne — reconnectez-vous pour déposer.',
    misc_error_generic: 'Erreur — réessaie plus tard.',
    stripe_btn_premium: '✦ Devenir Chasseur Premium',
    stripe_btn_commerce: '🏪 Activer le Plan Commerce',
    stripe_pending_premium: 'Paiement en ligne bientôt disponible — utilise un code pour l’instant.',
    stripe_pending_commerce: 'Paiement Commerce bientôt disponible — contacte contact@ghostub.app',
    dep_err_spam: '🏪 Pour les messages commerciaux, utilisez le Mode Commerce Premium.',
    dep_record_btn: 'Enregistrer un message vocal',
    dep_record_label: 'Enregistrer',
    dep_photo_btn_short: 'Ajouter une photo',
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
    dep_identity_named: '🌫️ Signé',
    dep_identity_anon: '👻 Anonyme',
    dep_secret_label: '🔮 Secret (3m)',
    dep_secret_normal: '👁 Normal',
    dep_next_btn: 'Continuer →',
    dep_chain_hint: 'Indice vers le prochain fantôme…',
    dep_chain_place: 'Placer le prochain point sur la carte',
    dep_chain_placed: '✓ Point placé — retap pour déplacer',
    dep_biz_btn: '🏪 Mode Commerce',
    dep_biz_sub: 'Attirer des clients avec une offre géolocalisée',
    dep_biz_active: 'Mode activé — formulaire commerce',
    dep_biz_deposit: '🏪 Publier cette offre',
    dep_biz_visual_title: 'Ajouter un visuel',
    dep_biz_visual_sub: 'Photo ou vidéo pour illustrer votre offre (optionnel).',
    dep_deposit_btn: '👻 Ancrer ce fantôme',
    dep_pending: 'En cours…',
    dep_deleting: '⏳ Suppression…',
    dep_secret_on: '🔮 Mode secret activé',
    dep_secret_off: '🔮 Passer en secret',
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
    profile_resonances: 'Résonances',
    profile_first_reader: 'Premiers lecteurs',
    profile_favorites: 'Favoris',
    profile_notif_on: 'Notifications activées ✓',
    profile_notif_off: 'Activer les notifications',
    profile_notif_blocked: '🔕 Notifications bloquées — autorisez-les dans les réglages de votre navigateur.',
    profile_notif_enabled: '🔔 Notifications activées !',
    profile_notif_disabled: '🔕 Notifications désactivées.',
    profile_notif_denied: '🔕 Permission refusée — autorisez dans les réglages du navigateur.',
    profile_premium_label: '👑 Spectre Premium',
    profile_premium_sub: 'Toutes les fonctionnalités débloquées',
    profile_free_label: 'Plan gratuit',
    profile_premium_plan: 'Spectre Premium',
    profile_premium_sub: 'Toutes les fonctionnalités débloquées',
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
    profile_premium_toast: '👑 Premium activé ! Toutes les fonctionnalités sont débloquées.',
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
    profile_delete_success: '✓ {n} fantômes supprimés',
    profile_delete_err: 'Erreur — réessayez',
    profile_export_btn: '⬇ Exporter mes données',
    profile_export_ok: '✓ Export téléchargé',
    profile_export_empty: 'Aucune donnée à exporter',
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
    ghost_secret_locked: '🔮 Ce fantôme est secret — approchez-vous à moins de 3m pour le révéler.',
    // Map
    map_you: '📍 Vous êtes ici',
    map_hunt_on: '🎯 Chasse ON',
    map_hunt_off: '🎯 Chasse',
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
    ob_title2: 'Ouvrez', ob_sub2: 'Chaque message est une<br>enveloppe scellée à dévoiler.',
    ob_title3: 'Résonnez', ob_sub3: 'Une résonance par jour —<br>choisissez le message qui vous touche.',
    ob_cta: 'Entrer dans les lieux ›',
    ob_swipe_hint: 'Glissez pour découvrir →',
    ob_free: 'Gratuit · Sans pub',
    auth_login_tab: 'Connexion',
    auth_register_tab: 'Inscription',
    auth_pass_hint: '6 caractères minimum',
    radar_area_title: 'Aux alentours',
    radar_invoke_btn: '↻ Invoquer',
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
    empreinte_favoris: '★ Favoris',
    empreinte_premier: '🥇 Premier lecteur',
    empreinte_classement: 'Classement',
    profile_stats_label: 'Mes stats',
    profile_top_hunters: '🏆 Top chasseurs',
    profile_map_section: '🗺 Mon empreinte fantôme',
    profile_biz_section: '🏪 Mes offres Commerce',
    profile_discoveries_panel: 'Mes découvertes',
    profile_deposited_panel: 'Mes fantômes déposés',
    profile_favorites_panel: '★ Mes favoris',
    profile_account_section: 'Mon compte',
    profile_code_hint: 'Vous avez un code d\'activation ?',
    profile_share_profile: '↗ Partager mon profil',
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
    help_legal_title: '📋 Mentions légales & RGPD',
    help_legal_body: '<strong>Éditeur :</strong> Ghostub — application indépendante<br><strong>Contact :</strong> contact@ghostub.app<br><br><strong>Données collectées :</strong> adresse email, position GPS (uniquement lors de l\'utilisation), messages déposés.<br><br><strong>Utilisation :</strong> vos données sont utilisées exclusivement pour le fonctionnement de l\'application. Elles ne sont ni vendues ni transmises à des tiers.<br><br><strong>Suppression :</strong> vous pouvez supprimer vos fantômes et votre compte à tout moment depuis votre profil.<br><br><strong>Hébergement :</strong> Firebase (Google) — serveurs européens (europe-west9).<br><br>En utilisant Ghostub, vous acceptez que vos messages soient visibles par d\'autres utilisateurs à proximité géographique.',
    help_version: 'Ghostub v1.0 — Géocaching émotionnel',
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
    // Radar
    radar_locating: 'Getting your location…',
    radar_searching: '🔍 Searching for ghosts…',
    radar_no_gps: 'Location denied — enable it in your browser settings.',
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
    detail_share_ghost_btn: '↗ Share this ghost',
    detail_reply_ghost_btn: '↩ Leave a reply here',
    dep_back: '← Back',
    detail_sealed_hint: 'Move closer to break the seal',
    detail_of_anon: 'From 👻 Anonymous · ',
    detail_of: 'From ',
    detail_from_you: 'from you',
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
    env_gps_denied: '⚠️ GPS unavailable — enable it and try outside.',
    env_resist: '🌫️ The seal still resists',
    env_resist_dist: '{n}m still to go',
    env_hint_reset: 'Move closer to break the seal',
    // Deposit
    dep_title: 'Drop',
    dep_msg_placeholder: 'Leave a message at this spot…',
    dep_loc_placeholder: 'Place name (street, café, park…)',
    dep_loc_searching: 'Looking up place…',
    dep_emoji_placeholder: 'Emoji (👻)',
    dep_btn: '👻 Anchor this ghost',
    dep_btn_upload: '⬆ Uploading…',
    dep_btn_saving: '✓ Upload · Saving…',
    dep_success: '👻 Your trace is anchored to this place…',
    dep_err_msg: 'Write a message.',
    dep_err_long: 'Message too long (280 chars max).',
    dep_err_gps: 'Location required — enable it in your browser.',
    dep_err_offline: 'You\'re offline — reconnect to drop a ghost.',
    misc_error_generic: 'Error — please try again later.',
    stripe_btn_premium: '✦ Become a Premium Hunter',
    stripe_btn_commerce: '🏪 Activate Commerce Plan',
    stripe_pending_premium: 'Online payment coming soon — use a code for now.',
    stripe_pending_commerce: 'Commerce payment coming soon — contact contact@ghostub.app',
    dep_err_spam: '🏪 For commercial messages, use the Premium Commerce Mode.',
    dep_record_btn: 'Record a voice message',
    dep_record_label: 'Record',
    dep_photo_btn_short: 'Add a photo',
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
    dep_identity_named: '🌫️ Signed',
    dep_identity_anon: '👻 Anonymous',
    dep_secret_label: '🔮 Secret (3m)',
    dep_secret_normal: '👁 Normal',
    dep_next_btn: 'Continue →',
    dep_chain_hint: 'Hint toward the next ghost…',
    dep_chain_place: 'Place the next point on the map',
    dep_chain_placed: '✓ Point placed — tap again to move',
    dep_biz_btn: '🏪 Commerce Mode',
    dep_biz_sub: 'Attract customers with a geolocated offer',
    dep_biz_active: 'Mode on — commerce form',
    dep_biz_deposit: '🏪 Publish this offer',
    dep_biz_visual_title: 'Add a visual',
    dep_biz_visual_sub: 'Photo or video to illustrate your offer (optional).',
    dep_deposit_btn: '👻 Anchor this ghost',
    dep_pending: 'Saving…',
    dep_deleting: '⏳ Deleting…',
    dep_secret_on: '🔮 Secret mode on',
    dep_secret_off: '🔮 Switch to secret',
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
    profile_first_reader: 'First reads',
    profile_favorites: 'Favorites',
    profile_notif_on: 'Notifications enabled ✓',
    profile_notif_off: 'Enable notifications',
    profile_notif_blocked: '🔕 Notifications blocked — allow them in your browser settings.',
    profile_notif_enabled: '🔔 Notifications enabled!',
    profile_notif_disabled: '🔕 Notifications disabled.',
    profile_notif_denied: '🔕 Permission denied — allow in browser settings.',
    profile_premium_label: '👑 Premium Spectre',
    profile_premium_sub: 'All features unlocked',
    profile_free_label: 'Free plan',
    profile_premium_plan: 'Spectre Premium',
    profile_premium_sub: 'All features unlocked',
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
    profile_premium_toast: '👑 Premium activated! All features are unlocked.',
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
    profile_delete_success: '✓ {n} ghosts deleted',
    profile_delete_err: 'Error — try again',
    profile_export_btn: '⬇ Export my data',
    profile_export_ok: '✓ Export downloaded',
    profile_export_empty: 'No data to export',
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
    ghost_secret_locked: '🔮 This ghost is secret — move within 3m to reveal it.',
    // Map
    map_you: '📍 You are here',
    map_hunt_on: '🎯 Hunt ON',
    map_hunt_off: '🎯 Hunt',
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
    ob_title2: 'Open', ob_sub2: 'Every message is a<br>sealed envelope to unveil.',
    ob_title3: 'Resonate', ob_sub3: 'One resonance a day —<br>pick the message that moves you.',
    ob_cta: 'Enter the locations ›',
    ob_swipe_hint: 'Swipe to discover →',
    ob_free: 'Free · No ads',
    auth_login_tab: 'Sign in',
    auth_register_tab: 'Sign up',
    auth_pass_hint: '6 characters minimum',
    radar_area_title: 'Nearby',
    radar_invoke_btn: '↻ Invoke',
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
    empreinte_favoris: '★ Favorites',
    empreinte_premier: '🥇 First reader',
    empreinte_classement: 'Leaderboard',
    profile_stats_label: 'My stats',
    profile_top_hunters: '🏆 Top hunters',
    profile_map_section: '🗺 My ghost footprint',
    profile_biz_section: '🏪 My commerce offers',
    profile_discoveries_panel: 'My discoveries',
    profile_deposited_panel: 'My dropped ghosts',
    profile_favorites_panel: '★ My favorites',
    profile_account_section: 'My account',
    profile_code_hint: 'Have an activation code?',
    profile_share_profile: '↗ Share my profile',
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
    help_legal_title: '📋 Legal & GDPR',
    help_legal_body: '<strong>Publisher:</strong> Ghostub — independent application<br><strong>Contact:</strong> contact@ghostub.app<br><br><strong>Data collected:</strong> email address, GPS position (only during use), deposited messages.<br><br><strong>Use:</strong> your data is used exclusively for the application to function. It is neither sold nor shared with third parties.<br><br><strong>Deletion:</strong> you can delete your ghosts and account at any time from your profile.<br><br><strong>Hosting:</strong> Firebase (Google) — European servers (europe-west9).<br><br>By using Ghostub, you agree that your messages are visible to other users in geographic proximity.',
    help_version: 'Ghostub v1.0 — Emotional geocaching',

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
  if (typeof loadNearbyGhosts === 'function') loadNearbyGhosts().catch(() => {});
};

// Appliquer la langue au démarrage
document.documentElement.lang = _currentLang;
document.addEventListener("DOMContentLoaded", () => { setLang(_currentLang); });


const firebaseConfig = {
  apiKey: "AIzaSyDtxsiaZgs2iycJRBK3SCvNuOarW7wEWaI",
  authDomain: "fantome-app.firebaseapp.com",
  projectId: "fantome-app",
  storageBucket: "fantome-app.firebasestorage.app",
  messagingSenderId: "62498675696",
  appId: "1:62498675696:web:9df717cdcda47a84d1db35"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CLOUDINARY_CLOUD = 'dcarogsye';
const CLOUDINARY_UPLOAD_PRESET = 'fantome_unsigned';

let currentUser = null;
let isPremium = false;
window._dbg = () => console.log('isPremium:', isPremium, '| pendingVideo:', !!window._pendingVideoFile);
let userLat = null;
let userLng = null;
let nearbyGhosts = [];
let selectedGhost = null;
let map = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingInterval = null;

// ── ANALYTICS LÉGER ─────────────────────────────────────
// Stocke les événements localement + log console (extensible vers Firebase Analytics)
const Analytics = {
  events: JSON.parse(localStorage.getItem('ghostub_analytics') || '[]'),
  track(event, params = {}) {
    const entry = { event, params, ts: Date.now() };
    this.events.push(entry);
    // Garde seulement les 200 derniers événements
    if (this.events.length > 200) this.events.shift();
    try { localStorage.setItem('ghostub_analytics', JSON.stringify(this.events)); } catch(e) {}
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
  GHOST_STATS: 'ghostStats'
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
  const durations = { '24h': 86_400_000, '7 jours': 604_800_000, '1 mois': 2_592_000_000 };
  const maxAge = durations[g.duration];
  if (!maxAge) return false;
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

window.renderStaticMap = () => {
  const centerLat = userLat || 48.8566; // Paris par défaut si GPS indisponible
  const centerLng = userLng || 2.3522;
  const container = document.getElementById('mapContainer');
  const h = Math.max(window.innerHeight - 160, 500);
  container.style.height = h + 'px';

  if (!document.getElementById('leafletCSS')) {
    const css = document.createElement('link');
    css.id = 'leafletCSS';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }

  if (window.L) {
    buildLeafletMap(centerLat, centerLng, h);
  } else {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => buildLeafletMap(centerLat, centerLng, h);
    document.head.appendChild(script);
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
    btn.style.background = 'rgba(168,180,255,.25)';
    btn.style.color = 'rgba(200,210,255,1)';
    btn.style.borderColor = 'rgba(168,180,255,.7)';
    btn.textContent = t.map_hunt_on;
    showToast('info', t.map_hunt_toast);
  } else {
    btn.style.background = 'rgba(168,180,255,.08)';
    btn.style.color = 'rgba(168,180,255,.7)';
    btn.style.borderColor = 'rgba(168,180,255,.25)';
    btn.textContent = t.map_hunt_off;
  }
  if (window.map) renderStaticMap();
};

function buildLeafletMap(centerLat, centerLng, h) {
  const container = document.getElementById('mapContainer');

  // Si la carte existe déjà — réutiliser sans reconstruire
  if (map && document.getElementById('leafletMap')) {
    map.setView([centerLat, centerLng], map.getZoom());
    setTimeout(() => map.invalidateSize(), 100);
    _updateMapMarkers(centerLat, centerLng);
    return;
  }

  container.innerHTML = `<div id="leafletMap" style="width:100%;height:${h}px;"></div>`;
  if (map) { try { map.remove(); } catch(e){} map = null; }

  map = L.map('leafletMap', { zoomControl: true, attributionControl: false })
          .setView([centerLat, centerLng], 16);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: '© CartoDB © OpenStreetMap' }).addTo(map);

  const userIcon = L.divIcon({
    html: '<div class="user-map-dot"></div>',
    iconSize: [16,16], iconAnchor: [8,8], className: ''
  });
  L.marker([centerLat, centerLng], { icon: userIcon }).addTo(map).bindPopup('📍 Vous êtes ici');

  // En mode chasse : cercle de détection autour de l'utilisateur
  if (huntMode) {
    L.circle([centerLat, centerLng], {
      radius: 50,
      color: 'rgba(168,180,255,0.6)',
      fillColor: 'rgba(168,180,255,0.08)',
      fillOpacity: 1,
      weight: 1.5,
      dashArray: '4 4'
    }).addTo(map);
  }

  nearbyGhosts.forEach((g, i) => {
    if (!g.lat || !g.lng) return;
    const emoji = g.secret ? '🔮' : (g.businessMode ? '🏪' : escapeHTML(g.emoji || '👻'));
    const delay = (i * 0.3).toFixed(2);
    const ghostRadius = Math.max(20, parseInt(g.radius || '50') || 50);
    const dist = distanceMeters(centerLat, centerLng, g.lat, g.lng);
    const isInRange = dist <= ghostRadius;
    const alreadyOpened = getDiscoveredIds().includes(g.id);

    if (huntMode) {
      // Mode chasse : icône différente selon proximité
      const huntIcon = L.divIcon({
        html: alreadyOpened
          ? `<div style="font-size:26px;opacity:0.5;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">${emoji}</div>`
          : isInRange
          ? `<div style="font-size:28px;animation:ghostFloat 2.8s ease-in-out infinite;animation-delay:${delay}s;filter:drop-shadow(0 0 10px rgba(100,255,180,0.9));cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">${emoji}</div>`
          : `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;cursor:pointer;">
               <div style="font-size:26px;filter:blur(1px) grayscale(0.5);opacity:0.7;animation:ghostFloat 2.8s ease-in-out infinite;animation-delay:${delay}s;">${emoji}</div>
               <div style="position:absolute;bottom:-2px;right:-2px;background:rgba(30,20,50,0.9);border:1px solid rgba(168,180,255,.4);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;">🔒</div>
             </div>`,
        iconSize: [44, 44], iconAnchor: [22, 22], className: ''
      });

      // Cercle de rayon autour du fantôme
      if (!alreadyOpened) {
        L.circle([g.lat, g.lng], {
          radius: ghostRadius,
          color: isInRange ? 'rgba(100,255,180,0.5)' : 'rgba(168,180,255,0.2)',
          fillColor: isInRange ? 'rgba(100,255,180,0.05)' : 'transparent',
          fillOpacity: 1,
          weight: 1,
          dashArray: isInRange ? '' : '3 5'
        }).addTo(map);
      }

      L.marker([g.lat, g.lng], { icon: huntIcon })
        .addTo(map)
        .on('click', () => {
          if (alreadyOpened) {
            showToast('info', t.map_hunt_already);
          } else if (isInRange) {
            openGhost(g.id);
            showScreen('screenDetail');
            setNav('nav-radar');
          } else {
            const distText = dist >= 1000 ? (dist/1000).toFixed(1)+'km' : Math.round(dist)+'m';
            showToast('warning', `🔒 Encore ${distText} à parcourir pour l'ouvrir`);
            if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
          }
        });
    } else {
      // Mode normal — apparition progressive selon distance
      let ghostHtml;
      if (dist <= 30) {
        // Très proche : pleine lueur + pulse
        ghostHtml = `<div style="font-size:30px;animation:ghostFloat 2.8s ease-in-out infinite,ghostPulseGlow 2s ease-in-out infinite;animation-delay:${delay}s,${delay}s;filter:drop-shadow(0 0 14px rgba(168,180,255,1)) drop-shadow(0 0 28px rgba(168,180,255,0.6));cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;opacity:1;">${emoji}</div>`;
      } else if (dist <= 100) {
        // Proche : lueur modérée
        ghostHtml = `<div style="font-size:27px;animation:ghostFloat 2.8s ease-in-out infinite;animation-delay:${delay}s;filter:drop-shadow(0 0 8px rgba(168,180,255,0.7));cursor:pointer;display:flex;align-items:center;justify-content:center;width:36px;height:36px;opacity:0.85;">${emoji}</div>`;
      } else {
        // Loin : flou, quasi fantomatique
        const farOpacity = Math.max(0.25, 0.6 - (dist / 1000));
        ghostHtml = `<div style="font-size:24px;animation:ghostFloat 3.5s ease-in-out infinite;animation-delay:${delay}s;filter:blur(1.5px) drop-shadow(0 0 3px rgba(168,180,255,0.25));cursor:pointer;display:flex;align-items:center;justify-content:center;width:32px;height:32px;opacity:${farOpacity.toFixed(2)};">${emoji}</div>`;
      }
      const ghostIcon = L.divIcon({
        html: ghostHtml,
        iconSize: [40, 40], iconAnchor: [20, 20], className: ''
      });
      L.marker([g.lat, g.lng], { icon: ghostIcon })
        .addTo(map)
        .on('click', () => {
          openGhost(g.id);
          showScreen('screenDetail');
          setNav('nav-radar');
        });
    }
  });

  // ── GHOST SPOTS : clusters 3+ ghosts dans 50m ───────────
  const _spotted = new Set();
  nearbyGhosts.forEach((g, i) => {
    if (_spotted.has(g.id) || !g.lat || !g.lng) return;
    const cluster = nearbyGhosts.filter(h =>
      h.id !== g.id && h.lat && h.lng &&
      distanceMeters(g.lat, g.lng, h.lat, h.lng) <= 50
    );
    if (cluster.length >= 2) { // g + 2 autres = 3 au total
      const clusterIds = [g.id, ...cluster.map(h => h.id)];
      clusterIds.forEach(id => _spotted.add(id));
      const spotIcon = L.divIcon({
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:56px;height:56px;border-radius:50%;background:rgba(255,200,80,.08);border:1.5px solid rgba(255,200,80,.4);animation:ghostFloat 3s ease-in-out infinite;"></div>
          <div style="font-size:11px;font-weight:600;color:rgba(255,200,80,.9);background:rgba(10,8,20,.85);border:1px solid rgba(255,200,80,.5);border-radius:20px;padding:3px 8px;white-space:nowrap;position:relative;z-index:1;">✦ Ghost Spot · ${clusterIds.length}</div>
        </div>`,
        iconSize: [120, 32], iconAnchor: [60, 16], className: ''
      });
      L.marker([g.lat, g.lng], { icon: spotIcon })
        .addTo(map)
        .on('click', () => showToast('info', clusterIds.length + (_currentLang === 'en' ? ' presences here — come closer!' : ' présences ici — approche-toi !')));
    }
  });
  setTimeout(() => map && map.invalidateSize(), 500);
  Analytics.track('map_opened', { ghost_count: nearbyGhosts.length, hunt_mode: huntMode });
}


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

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    watchMyGhostResonances();
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
    document.getElementById('profileAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
    const userDoc = await getDoc(doc(db, COLL.USERS, user.uid));
    isPremium = userDoc.exists() && userDoc.data().premium === true;
    updatePremiumUI();
    _renderPricingCards();
    showScreen('screenRadar');
    setNav('nav-radar');
    // ── Présence passive — GPS watch ─────────────────────────────────
    if (!window._locationWatchStarted) {
      window._locationWatchStarted = true;
    LocationService.startWatch();
    let _firstAccuratePosition = false;
    LocationService.onPositionUpdate(({ lat, lng, accuracy }) => {
      // Ignorer les positions trop imprécises (IP-based = Paris, accuracy > 5000m)
      if (accuracy && accuracy > 5000) return;
      // Recentrer la carte si c'est la première position réelle reçue
      if (!userLat && window.map) {
        window.map.setView([lat, lng], 16);
      }
      userLat = lat; userLng = lng;
      // Recharger les fantômes à la première position GPS précise
      // pour corriger les distances calculées depuis le fallback
      if (!_firstAccuratePosition) {
        _firstAccuratePosition = true;
        loadNearbyGhosts();
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
            distEl.style.cssText = 'background:rgba(100,220,160,.1);border:1px solid rgba(100,220,160,.25);color:rgba(100,220,160,.9);';
          } else if (dist <= 200) {
            distEl.style.cssText = 'background:rgba(255,200,80,.08);border:1px solid rgba(255,200,80,.2);color:rgba(255,200,80,.8);';
          } else {
            distEl.style.cssText = 'background:rgba(168,180,255,.08);border:1px solid rgba(168,180,255,.12);color:rgba(168,180,255,.6);';
          }
        }
        if (dist <= 10) {
          card.style.boxShadow = '0 0 24px rgba(168,180,255,.45)';
          card.style.borderColor = 'rgba(168,180,255,.7)';
          card.classList.add('ghost-envelope-close');
          if (navigator.vibrate && !g._buzzed10) { navigator.vibrate([20, 40, 20]); g._buzzed10 = true; }
        } else if (dist <= 30) {
          card.style.boxShadow = '0 0 14px rgba(168,180,255,.25)';
          card.style.borderColor = 'rgba(168,180,255,.45)';
          card.classList.remove('ghost-envelope-close');
          g._buzzed10 = false;
        } else if (dist <= 100) {
          card.style.boxShadow = '0 0 6px rgba(168,180,255,.1)';
          card.style.borderColor = '';
          card.classList.remove('ghost-envelope-close');
        } else {
          card.style.boxShadow = '';
          card.style.borderColor = '';
          card.classList.remove('ghost-envelope-close');
          g._buzzed10 = false;
        }
      });
    });
    } // fin guard _locationWatchStarted
    document.getElementById('bottomNav').style.display = 'flex';
    // Obtenir la position GPS réelle avant de charger les fantômes
    try {
      await getLocation();
      if (window.map) window.map.setView([userLat, userLng], 16);
    } catch(e) {
      // GPS refusé ou timeout — garder fallback
    }
    await loadNearbyGhosts();
    // Vérifier les notifications de réponses au démarrage
    setTimeout(() => checkReplyNotifications(), 2000);
    // Vérifier si un profil public est demandé dans l'URL
    setTimeout(() => checkPublicProfileParam(), 1000);
    // Synchroniser les découvertes depuis Firestore (multi-appareils)
    syncDiscoveriesFromFirestore();
  } else {
    currentUser = null;
    document.getElementById('bottomNav').style.display = 'none';
    if (localStorage.getItem('ghostub_onboard_seen')) {
      showScreen('screenAuth');
    } else {
      showScreen('screenOnboard');
    }
  }
});

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
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: pseudo });
    Analytics.track('register');
  } catch(e) {
    err.textContent = e.code === 'auth/email-already-in-use' ? t.auth_err_email_used :
                      e.code === 'auth/weak-password' ? t.auth_err_short_pass :
                      'Erreur : ' + e.message;
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
    err.textContent = t.auth_err_wrong;
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
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: 'https://raw.githubusercontent.com/pimpimshop33-dotcom/ghostub/main/icon.png',
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
  } catch(e) {}
}

// ── NOTIFICATION RÉTENTION — FANTÔME JAMAIS OUVERT ───────
let _lastVirginNotif = 0;
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
  showToast('info', msg, 6000);
  showNotif(t.notif_nearby_sw_title, msg);
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
      ghostLocation: location,
      notified: false,
      createdAt: serverTimestamp()
    }).catch(() => {});
  }
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
        msg = `${escapeHTML(n.fromAuthor || 'Un inconnu')} a laissé une réponse à votre fantôme de <b>${lieu}</b>.`;
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
  } catch(e) {}
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
    btn.style.color = 'rgba(100,220,160,.9)';
  } else {
    if (span) span.textContent = t.profile_notif_off;
    btn.style.color = 'var(--text)';
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
    btn.style.borderColor = 'rgba(100,220,160,.4)';
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

registerServiceWorker().then(reg => {
  if (reg && localStorage.getItem('notif_enabled') === '1' && Notification.permission === 'granted') {
    _startNotifIntervals();
    const btn = document.getElementById('notifBtn');
    if (btn) {
      _setNotifBtnState(true);
      btn.style.borderColor = 'rgba(100,220,160,.4)';
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
    <div style="display:flex;align-items:center;gap:10px;background:linear-gradient(145deg,rgba(168,180,255,.08),rgba(168,180,255,.03));border:1px solid rgba(168,180,255,.2);border-radius:14px;padding:10px 12px;margin-top:8px;">
      <span style="font-size:18px;" aria-hidden="true">🎙</span>
      <audio controls src="${url}" style="flex:1;height:32px;" aria-label="Aperçu de l'enregistrement vocal"></audio>
      <button onclick="clearAudio()" aria-label="Supprimer l'enregistrement" style="background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.3);color:rgba(255,120,120,.8);cursor:pointer;font-size:13px;border-radius:8px;width:32px;height:32px;min-width:32px;">✕</button>
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
          <div style="position:relative;margin-top:8px;">
            <img src="${url}" alt="Aperçu de la photo" style="width:100%;border-radius:14px;border:1px solid rgba(168,180,255,.2);max-height:200px;object-fit:cover;box-shadow:0 4px 20px rgba(0,0,0,.5);" loading="lazy">
            <button onclick="clearPhoto()" aria-label="Supprimer la photo" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);color:white;border-radius:50%;width:32px;height:32px;min-width:32px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">✕</button>
            <div style="position:absolute;bottom:8px;left:8px;font-size:10px;background:rgba(0,0,0,.6);color:rgba(100,220,160,.8);border-radius:8px;padding:2px 7px;">${(blob.size/1024).toFixed(0)}ko</div>
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
    <div style="position:relative;margin-top:8px;border-radius:12px;overflow:hidden;border:1px solid rgba(168,180,255,.2);">
      <video src="${url}" controls playsinline style="width:100%;max-height:200px;display:block;background:#000;"></video>
      <button onclick="clearVideo()" aria-label="Supprimer la vidéo" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);color:white;border-radius:50%;width:32px;height:32px;min-width:32px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>`;
  input.value = '';
};

window.clearVideo = () => {
  if (window._pendingVideoBlobUrl) { URL.revokeObjectURL(window._pendingVideoBlobUrl); window._pendingVideoBlobUrl = null; }
  window._pendingVideoFile = null;
  document.getElementById('videoPreview').innerHTML = '';
};


async function uploadMedia(uid) {
  let audioUrl = null;
  let photoUrl = null;
  let videoUrl = null;

  // FIX: Helper avec retry x2 sur erreur réseau
  async function uploadToCloudinary(fd, resourceType) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method:'POST', body: fd });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.secure_url || null;
      } catch(e) {
        if (attempt === 1) throw e;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (window._pendingAudioBlob) {
    const fd = new FormData();
    fd.append('file', window._pendingAudioBlob, 'audio.webm');
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/audio');
    audioUrl = await uploadToCloudinary(fd, 'video');
  }
  if (window._pendingPhotoFile) {
    const fd = new FormData();
    fd.append('file', window._pendingPhotoFile);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/photos');
    photoUrl = await uploadToCloudinary(fd, 'image');
  }
  if (window._pendingVideoFile) {
    const fd = new FormData();
    fd.append('file', window._pendingVideoFile);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'ghostub/videos');
    videoUrl = await uploadToCloudinary(fd, 'video');
  }
  return { audioUrl, photoUrl, videoUrl };
}


// ── STREAK DE DÉCOUVERTE ─────────────────────────────────
function _getStreakKey() { return currentUser ? 'ghostub_streak_' + currentUser.uid : 'ghostub_streak_anon'; }
function _getStreak() {
  try { return JSON.parse(localStorage.getItem(_getStreakKey()) || '{"count":0,"lastDate":""}'); } catch(e) { return {count:0,lastDate:''}; }
}
function _updateStreak() {
  const today = new Date().toISOString().slice(0,10);
  const s = _getStreak();
  if (s.lastDate === today) return s; // déjà mis à jour aujourd'hui
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const newCount = s.lastDate === yesterday ? s.count + 1 : 1; // continuité ou reset
  const updated = { count: newCount, lastDate: today };
  localStorage.setItem(_getStreakKey(), JSON.stringify(updated));
  return updated;
}
function _renderStreak() {
  const s = _getStreak();
  const el = document.getElementById('streakDisplay');
  if (!el) return;
  if (s.count >= 2) {
    el.textContent = '🔥 ' + s.count + 'j';
    el.style.display = 'inline-block';
    el.title = s.count + ' jours consécutifs';
  } else {
    el.style.display = 'none';
  }
}

// ── MILESTONES ──────────────────────────────────────────
const MILESTONES = [1,5,10,25,50,100];
const RANKS_FR = [
  {min:0,   label:'Novice',    icon:'🌫️'},
  {min:5,   label:'Vagabond',  icon:'🚶'},
  {min:15,  label:'Spectre',   icon:'👻'},
  {min:40,  label:'Chasseur',  icon:'🔍'},
  {min:80,  label:'Légende',   icon:'⭐'},
];
const RANKS_EN = [
  {min:0,   label:'Novice',    icon:'🌫️'},
  {min:5,   label:'Wanderer',  icon:'🚶'},
  {min:15,  label:'Spectre',   icon:'👻'},
  {min:40,  label:'Hunter',    icon:'🔍'},
  {min:80,  label:'Legend',    icon:'⭐'},
];
const RANKS = () => _currentLang === 'en' ? RANKS_EN : RANKS_FR;

function getRank(n) {
  const ranks = RANKS();
  let rank = ranks[0];
  for (const r of ranks) { if (n >= r.min) rank = r; }
  return rank;
}

function showDiscoveryToast(count, isNew) {
  const toast = document.getElementById('discoveryToast');
  const icon  = document.getElementById('toastIcon');
  const text  = document.getElementById('toastText');
  if (!toast) return;
  const rank = getRank(count);
  const isMilestone = MILESTONES.includes(count) && isNew;
  if (isNew) { _updateStreak(); _renderStreak(); }
  if (isMilestone) {
    icon.textContent = rank.icon;
    text.innerHTML = '<b>' + count + ' ' + (_currentLang === 'fr' ? 'fantômes' : 'ghosts') + '</b> ' + (_currentLang === 'fr' ? 'découverts' : 'discovered') + ' ! <span class="milestone-badge">' + escapeHTML(rank.label) + '</span>';
    Analytics.track('milestone', { count, rank: rank.label });
  } else if (isNew) {
    icon.textContent = '👻';
    text.innerHTML = (_currentLang === 'fr' ? 'Fantôme découvert · <b>' + count + '</b> au total' : 'Ghost discovered · <b>' + count + '</b> total');
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
  try {
    // 1 lecture Firestore sur users/{uid} pour les compteurs dénormalisés
    const userSnap = await getDoc(doc(db, COLL.USERS, currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const _depKey2 = 'ghostub_total_deposited_' + currentUser.uid;
    const _localDep = parseInt(localStorage.getItem(_depKey2) || '0');
    if (userData.ghostCount != null) {
      animateStatNumber('statDeposited', Math.max(userData.ghostCount, _localDep));
    } else {
      // Fallback : compter les docs (migration douce)
      const snap = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid','==', currentUser.uid), limit(100)));
      animateStatNumber('statDeposited', Math.max(snap.size, _localDep));
    }
    if (userData.totalResonances != null) {
      animateStatNumber('statResonances', userData.totalResonances);
    } else {
      const snap2 = await getDocs(query(collection(db, COLL.GHOSTS), where('authorUid','==', currentUser.uid), limit(100)));
      let totalReso = 0;
      snap2.forEach(d => { totalReso += d.data().resonances || 0; });
      animateStatNumber('statResonances', totalReso);
    }
  } catch(e) { console.warn('refreshProfileStats:', e); }
}

// ── TABLEAU DE BORD COMMERÇANT ──────────────────────────
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
  } catch(e) {}

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
        expiryHtml = `<span style="color:rgba(255,160,60,.9);font-size:11px;">⏰ ${_currentLang === 'fr' ? 'Expire dans' : 'Expires in'} ${daysLeft}${_currentLang === 'fr' ? 'j' : 'd'}</span>`;
      } else if (daysLeft <= 0) {
        expiryHtml = `<span style="color:rgba(255,100,100,.7);font-size:11px;">⏳ ${_currentLang === 'fr' ? 'Expirée' : 'Expired'}</span>`;
      } else {
        expiryHtml = `<span style="color:var(--spirit-dim);font-size:11px;">⏳ ${daysLeft}${_currentLang === 'fr' ? 'j restants' : 'd left'}</span>`;
      }
    }

    // Badge ouvertures
    const opensColor = opens >= 10 ? 'rgba(100,220,160,.9)' : opens >= 3 ? 'rgba(255,200,80,.8)' : 'var(--spirit-dim)';

    html += `
      <div style="background:rgba(255,200,80,.04);border:1px solid rgba(255,200,80,.18);border-radius:14px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <span style="font-size:22px;flex-shrink:0;">🏪</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--ether);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;">${title}</div>
            <div style="font-size:11px;color:var(--spirit-dim);margin-top:2px;">${location}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;">
              <span style="color:${opensColor};font-size:13px;font-weight:600;">👁 ${opens} ${_currentLang === 'fr' ? 'ouverture' + (opens > 1 ? 's' : '') : 'open' + (opens > 1 ? 's' : '')}</span>
              ${expiryHtml}
              ${expired ? (_currentLang === 'fr' ? '<span style="color:rgba(255,100,100,.6);font-size:11px;">Expirée</span>' : '<span style="color:rgba(255,100,100,.6);font-size:11px;">Expired</span>') : ''}
            </div>
          </div>
        </div>
        ${!expired ? `<button onclick="renewBusinessGhost('${escapeHTML(id)}')" style="width:100%;margin-top:10px;padding:8px;background:rgba(255,200,80,.08);border:1px solid rgba(255,200,80,.3);border-radius:10px;color:rgba(255,200,80,.85);font-family:'Instrument Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s;">${_currentLang === 'fr' ? '↻ Renouveler pour 1 mois' : '↻ Renew for 1 month'}</button>` : ''}
      </div>`;
  });
  content.innerHTML = html || `<div style="opacity:.5;font-style:italic;text-align:center;padding:12px 0;">${_currentLang === 'fr' ? 'Aucune offre commerce active' : 'No active commerce offers'}</div>`;
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

window.toggleDiscoveryHistory = async () => {
  const panel = document.getElementById('discoveryHistory');
  const list = document.getElementById('discoveryHistoryList');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  // Fermer l'autre panel si ouvert
  document.getElementById('depositedList').style.display = 'none';
  panel.style.display = 'block';
  const ids = getDiscoveredIds();
  if (ids.length === 0) { list.innerHTML = `<div style="opacity:.5;font-style:italic;">${t.profile_no_discoveries || 'Aucune découverte encore…'}</div>`; return; }
  list.innerHTML = `<div style="opacity:.5;">${t.loading || 'Chargement…'}</div>`;
  try {
    const results = [];
    for (const id of ids.slice(-20).reverse()) { // 20 dernières
      try {
        const d = await getDoc(doc(db, COLL.GHOSTS, id));
        if (d.exists()) {
          const g = d.data();
          results.push(`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:20px;">${escapeHTML(g.emoji||'👻')}</span>
            <div>
              <div style="font-size:12px;color:var(--ether);">${escapeHTML(g.location||t.detail_location_unknown)}</div>
              <div style="font-size:11px;opacity:.5;">${g.createdAt ? new Date(g.createdAt.seconds*1000).toLocaleDateString(_currentLang === 'fr' ? 'fr-FR' : 'en-GB') : ''}</div>
            </div>
          </div>`);
        }
      } catch(e) {}
    }
    list.innerHTML = results.length ? results.join('') : '<div style="opacity:.5;font-style:italic;">Données indisponibles</div>';
  } catch(e) { list.innerHTML = '<div style="opacity:.5;">Erreur de chargement</div>'; }
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
  content.innerHTML = `<div style="opacity:.5;">${t.loading || 'Chargement…'}</div>`;
  try {
    const snap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    ));
    if (snap.empty) {
      content.innerHTML = `<div style="opacity:.5;font-style:italic;">${t.profile_no_deposits || 'Aucun fantôme déposé encore…'}</div>`;
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
        <div id="deposited-item-${escapeHTML(id)}" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:22px;flex-shrink:0;">${escapeHTML(g.emoji||'👻')}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--ether);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(g.location||t.detail_location_unknown)}</div>
            <div style="font-size:11px;color:var(--spirit-dim);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;">
              <span>${date}</span>
              <span>✦ ${resonances} résonance${resonances > 1 ? 's' : ''}</span>
              <span>👁 ${g.openCount || 0} ${_currentLang === 'fr' ? 'ouverture' + ((g.openCount || 0) > 1 ? 's' : '') : 'open' + ((g.openCount || 0) > 1 ? 's' : '')}</span>
              ${expired ? '<span style="color:rgba(255,100,100,.6);">⏳ Expiré</span>' : ''}
              ${g.secret ? '<span style="color:rgba(168,100,255,.7);">🔮 Secret</span>' : ''}
            </div>
          </div>
          <button onclick="deleteOneGhost('${escapeHTML(id)}')" aria-label="Supprimer ce fantôme" style="background:rgba(255,80,80,.07);border:1px solid rgba(255,100,100,.25);border-radius:10px;color:rgba(255,100,100,.6);font-size:13px;padding:6px 10px;cursor:pointer;flex-shrink:0;transition:all .2s;" onmouseover="this.style.background='rgba(255,80,80,.15)'" onmouseout="this.style.background='rgba(255,80,80,.07)'">🗑</button>
        </div>`;
    });
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div style="opacity:.5;">Erreur de chargement</div>';
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
    { id: 'premSection_video',     icon: '🎥', label: 'Vidéo', sub: 'Jusqu’à 20 sec · s’ouvre uniquement sur place',
      premiumHtml: `<label class="form-label" style="display:flex;align-items:center;justify-content:space-between;"><span>Vidéo (optionnel)</span><span style="font-size:9px;background:rgba(255,200,80,.15);border:1px solid rgba(255,200,80,.3);border-radius:8px;padding:2px 6px;color:rgba(255,200,80,.8);">👑 Premium</span></label><button class="media-btn" onclick="triggerVideo()" type="button"><span class="media-icon">🎥</span><span>Ajouter une vidéo</span><span style="margin-left:auto;font-size:10px;opacity:.45;">max 50 Mo · 20 sec</span></button>` },
    { id: 'premSection_chain',     icon: '🔗', label: 'Chaîne de fantômes', sub: 'Chasse au trésor urbaine · enchaîne tes ghosts',
      premiumHtml: null }, // chainContent géré séparément
    { id: 'premSection_dedicated', icon: '💌', label: 'Pour quelqu’un', sub: 'Ghost secret réservé à une seule personne',
      premiumHtml: null }, // dedicatedContent géré séparément
  ];

  const _badge = (txt) => `<span class="badge-premium">✦ Premium</span>`;
  const _freeBtn = (icon, label, sub) => `<button class="cond-btn" onclick="showScreen('screenProfile');setNav('nav-profile')" type="button" style="width:100%;"><span class="cond-btn-icon">${icon}</span><span class="cond-btn-text"><div class="cond-btn-label">${label} ${_badge()}</div><div class="cond-btn-sub">${sub}</div></span></button>`;

  _premSections.forEach(({ id, icon, label, sub, premiumHtml }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = isPremium
      ? (premiumHtml || '')
      : _freeBtn(icon, label, sub);
  });

  // Afficher/masquer chainContent et dedicatedContent
  const chainContent = document.getElementById('chainContent');
  if (chainContent) chainContent.style.display = isPremium ? 'flex' : 'none';
  const dedContent = document.getElementById('dedicatedContent');
  if (dedContent) dedContent.style.display = isPremium ? 'block' : 'none';
  // Badge avatar Premium
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    avatar.style.border = isPremium
      ? '1.5px solid rgba(255,200,80,.6)'
      : '1px solid var(--border-bright)';
    avatar.style.boxShadow = isPremium ? '0 0 14px rgba(255,200,80,.2)' : '';
    // Badge ✦ Premium sous l'avatar
    const existingBadge = document.getElementById('premiumAvatarBadge');
    if (isPremium && !existingBadge) {
      const badge = document.createElement('div');
      badge.id = 'premiumAvatarBadge';
      badge.textContent = '✦ Premium';
      badge.style.cssText = 'font-size:10px;color:rgba(255,200,80,.85);background:rgba(255,200,80,.1);border:1px solid rgba(255,200,80,.3);border-radius:20px;padding:2px 10px;margin-top:4px;letter-spacing:.5px;display:inline-block;';
      avatar.parentNode.insertBefore(badge, avatar.nextSibling);
    } else if (!isPremium && existingBadge) {
      existingBadge.remove();
    }
  }
  const pricingSection = document.getElementById('pricingSection');
  if (isPremium) {
    planEl.style.display = 'block';
    planEl.innerHTML = '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,200,80,.7);margin-bottom:4px;">👑 ' + t.profile_premium_plan + '</div><div style="font-size:13px;color:var(--warm-dim);">' + t.profile_premium_sub + '</div>';
    if (codeSection) codeSection.style.display = 'none';
    if (pricingSection) pricingSection.style.display = 'none';
  } else {
    planEl.style.display = 'none';
    if (codeSection) codeSection.style.display = 'block';
    if (pricingSection) pricingSection.style.display = 'block';
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
    <!-- Premium -->
    <div style="background:linear-gradient(160deg,rgba(168,180,255,.07),rgba(168,180,255,.02));border:1px solid rgba(168,180,255,.3);border-radius:16px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(168,180,255,.7);margin-bottom:2px;">👑 ${isEn ? 'Premium Hunter' : 'Chasseur Premium'}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-style:italic;color:var(--ether);">0,99€ <span style="font-size:14px;color:var(--spirit-dim);font-style:normal;">${isEn ? '/month' : '/mois'}</span></div>
        </div>
        <div style="font-size:32px;filter:drop-shadow(0 0 12px rgba(168,180,255,.4));">👻</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Unlimited openings' : 'Ouvertures illimitées'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Instant drop' : 'Dépôt immédiat'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Video + audio 🎥' : 'Vidéo + vocal 🎥'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Dedicated ghost 💌' : 'Ghost dédié 💌'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Ghost chain 🔗' : 'Chaîne fantômes 🔗'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(100,220,160,.8);">✓</span> ${isEn ? 'Future message 📅' : 'Message futur 📅'}</div>
      </div>
      <button id="stripeBtn" onclick="startStripeCheckout('premium')" style="width:100%;padding:13px;background:linear-gradient(135deg,rgba(168,180,255,.25),rgba(168,180,255,.1));border:1px solid rgba(168,180,255,.5);border-radius:13px;color:var(--ether);font-family:'Instrument Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;touch-action:manipulation;">${t.stripe_btn_premium || '✦ Become Premium Hunter'}</button>
    </div>
    <!-- Commerce -->
    <div style="background:linear-gradient(160deg,rgba(255,200,80,.06),rgba(255,200,80,.02));border:1px solid rgba(255,200,80,.25);border-radius:16px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,200,80,.7);margin-bottom:2px;">🏪 ${isEn ? 'Commerce Plan' : 'Plan Commerce'}</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-style:italic;color:var(--ether);">4,99€ <span style="font-size:14px;color:var(--spirit-dim);font-style:normal;">${isEn ? '/month' : '/mois'}</span></div>
        </div>
        <div style="font-size:32px;filter:drop-shadow(0 0 12px rgba(255,200,80,.4));">🏪</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px;">
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(255,200,80,.8);">✓</span> ${isEn ? 'All Premium included' : 'Tout Premium inclus'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(255,200,80,.8);">✓</span> ${isEn ? 'Commerce ghosts' : 'Ghosts Commerce'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(255,200,80,.8);">✓</span> ${isEn ? 'Promo code built-in' : 'Code promo intégré'}</div>
        <div style="font-size:11px;color:var(--warm-dim);display:flex;align-items:center;gap:5px;"><span style="color:rgba(255,200,80,.8);">✓</span> ${isEn ? 'Openings dashboard' : 'Dashboard ouvertures'}</div>
      </div>
      <button id="stripeBtnCommerce" onclick="startStripeCheckout('commerce')" style="width:100%;padding:13px;background:linear-gradient(135deg,rgba(255,200,80,.2),rgba(255,200,80,.06));border:1px solid rgba(255,200,80,.4);border-radius:13px;color:rgba(255,200,80,.9);font-family:'Instrument Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;touch-action:manipulation;">${t.stripe_btn_commerce || '🏪 Activate Commerce Plan'}</button>
    </div>
    <!-- Code promo discret -->
    <div id="codeSection" style="padding:4px 0;">
      <details style="cursor:pointer;">
        <summary style="font-size:11px;color:rgba(168,180,255,.35);letter-spacing:.3px;list-style:none;padding:6px 0;">${isEn ? 'Have an activation code?' : 'Vous avez un code d\'activation ?'}</summary>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input id="premiumCode" class="form-input" type="text" placeholder="CODE-XXXX" aria-label="Code Premium" style="flex:1;font-size:13px !important;text-transform:uppercase;letter-spacing:1px;">
          <button id="activateBtn" onclick="activatePremium()" style="padding:10px 14px;background:linear-gradient(135deg,rgba(255,200,80,.15),rgba(255,200,80,.06));border:1px solid rgba(255,200,80,.4);border-radius:12px;color:rgba(255,200,80,.9);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer;white-space:nowrap;min-height:44px;">${t.profile_activate_btn || 'Activer'}</button>
        </div>
        <div id="premiumError" style="font-size:11px;color:var(--red);margin-top:4px;min-height:14px;" role="alert" aria-live="polite"></div>
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
    // Transaction atomique : lecture + écriture en une seule opération
    // → impossible d'activer le même code deux fois simultanément
    await runTransaction(db, async (txn) => {
      const codeRef = doc(db, COLL.PREMIUM_CODES, code);
      const codeSnap = await txn.get(codeRef);
      if (!codeSnap.exists()) throw { code: 'not-found' };
      if (codeSnap.data().used) throw { code: 'already-used' };
      const userRef = doc(db, COLL.USERS, currentUser.uid);
      txn.update(codeRef, { used: true, usedBy: currentUser.uid, usedAt: serverTimestamp() });
      txn.set(userRef, { premium: true, premiumSince: serverTimestamp() }, { merge: true });
    });
    isPremium = true;
    updatePremiumUI();
    input.value = '';
    btn.textContent = t.profile_activated;
    showToast('success', t.profile_premium_toast, 4000);
    Analytics.track('premium_activated');
  } catch(e) {
    if (e.code === 'not-found') errEl.textContent = t.profile_code_invalid;
    else if (e.code === 'already-used') errEl.textContent = t.profile_code_used;
    else errEl.textContent = 'Erreur : ' + e.message;
    btn.textContent = t.profile_activate_btn;
    btn.disabled = false;
  }
};

// ── SIGNALEMENT ─────────────────────────────────────────
const REPORT_THRESHOLD = 3;

function openReportModal() {
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
    await updateDoc(doc(db, COLL.GHOSTS, ghostId), { reportCount: increment(1) });
    const ghostDoc = await getDocs(query(collection(db, COLL.REPORTS), where('ghostId', '==', ghostId)));
    if (ghostDoc.size >= REPORT_THRESHOLD) {
      await deleteDoc(doc(db, COLL.GHOSTS, ghostId));
      showScreen('screenRadar');
      setNav('nav-radar');
      await loadNearbyGhosts();
      showReportFeedback(t.toast_report_del);
      return;
    }
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
  const icons = { success: '✓', error: '✕', warning: '⚠', info: '👻', report: '⚑', link: '🔗' };
  if (!toast || !icon || !text) return;
  icon.textContent = icons[type] || '👻';
  text.innerHTML = sanitizeToastMsg(msg);
  toast.style.borderColor = 'rgba(168,180,255,.25)';
  if (type === 'success') toast.style.borderColor = 'rgba(100,220,160,.3)';
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
    ctx.strokeStyle = 'rgba(168,180,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 130); ctx.lineTo(W-80, 130); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, H-130); ctx.lineTo(W-80, H-130); ctx.stroke();

    // App name
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(168,180,255,0.45)';
    ctx.font = '500 36px "Instrument Sans", sans-serif';
    ctx.fillText('GHOSTUB', W/2, 100);

    // Compteur central
    ctx.fillStyle = 'rgba(230,225,255,0.95)';
    ctx.font = `bold ${count >= 10 ? 140 : 160}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(String(count), W/2, H/2 - 20);

    // Label sous le chiffre
    ctx.fillStyle = 'rgba(168,180,255,0.7)';
    ctx.font = 'italic 52px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? (count > 1 ? 'presences detected' : 'presence detected') : (count > 1 ? 'présences détectées' : 'présence détectée'), W/2, H/2 + 60);

    // Lieu (GPS)
    if (userLat && userLng) {
      ctx.fillStyle = 'rgba(255,240,200,0.6)';
      ctx.font = '38px "Instrument Sans", sans-serif';
      ctx.fillText(`${userLat.toFixed(3)}° N  ${userLng.toFixed(3)}° E`, W/2, H/2 + 140);
    }

    // CTA
    ctx.fillStyle = 'rgba(168,180,255,0.4)';
    ctx.font = '34px "Instrument Sans", sans-serif';
    ctx.fillText(_currentLang === 'en' ? 'Come closer to discover what awaits you' : 'Approche-toi pour découvrir ce qui t’attend', W/2, H - 170);
    ctx.fillStyle = 'rgba(168,180,255,0.2)';
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
        } catch(e) {}
      } else {
        _downloadCanvas(canvas, 'ghostub-lieu.png');
      }
      if (btn) { btn.textContent = '↗ Partager'; btn.disabled = false; }
    }, 'image/png');

  } catch(e) {
    console.warn('shareMapLocation:', e);
    if (btn) { btn.textContent = '↗ Partager'; btn.disabled = false; }
  }
};

function _downloadCanvas(canvas, name) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name; a.click();
}

function buildShareLink(ghost) {
  const base = 'https://pimpimshop33-dotcom.github.io/ghostub/';
  const params = new URLSearchParams({
    ghost: ghost.id,
    lat: ghost.lat ? ghost.lat.toFixed(5) : '',
    lng: ghost.lng ? ghost.lng.toFixed(5) : '',
    loc: ghost.location || 'Lieu mystérieux'
  });
  if (currentUser) params.set('ref', currentUser.uid.slice(0, 8));
  return base + '?' + params.toString();
}


// ── GHOST CARD GENERATOR ──────────────────────────────────
window.generateGhostCard = async () => {
  if (!selectedGhost) return;
  const btn = document.getElementById('ghostCardBtn');
  if (btn) { btn.textContent = '⏳ Génération…'; btn.disabled = true; }

  try {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Fond ─────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#06040e');
    bg.addColorStop(0.5, '#0a0818');
    bg.addColorStop(1,   '#04030c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Étoiles
    const rng = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
    for (let i = 0; i < 180; i++) {
      const x = rng(i * 7.3) * W;
      const y = rng(i * 13.7) * H;
      const r = rng(i * 3.1) * 1.8 + 0.3;
      const a = rng(i * 5.9) * 0.6 + 0.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${a})`;
      ctx.fill();
    }

    // Halo central
    const halo = ctx.createRadialGradient(W/2, H*0.42, 0, W/2, H*0.42, 420);
    halo.addColorStop(0,   'rgba(140,100,255,0.18)');
    halo.addColorStop(0.5, 'rgba(100,80,200,0.07)');
    halo.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Ligne déco haut
    ctx.strokeStyle = 'rgba(168,180,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 140); ctx.lineTo(W-80, 140); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, 146); ctx.lineTo(W-80, 146); ctx.stroke();

    // ── Logo / app name ──────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(168,180,255,0.5)';
    ctx.font = '500 38px "Instrument Sans", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('GHOSTUB', W/2, 110);
    ctx.letterSpacing = '0px';

    // ── Ghost emoji central ───────────────────────────────
    ctx.font = '200px serif';
    ctx.fillText('👻', W/2, H*0.42);

    // ── Message principal ─────────────────────────────────
    ctx.fillStyle = 'rgba(230,225,255,0.92)';
    ctx.font = 'italic 72px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? 'I broke a seal' : 'J’ai brisé un sceau', W/2, H*0.56);

    ctx.fillStyle = 'rgba(168,180,255,0.6)';
    ctx.font = 'italic 52px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? 'in this place…' : 'dans ce lieu…', W/2, H*0.56 + 80);

    // ── Lieu ─────────────────────────────────────────────
    const lieu = selectedGhost.location || 'Lieu inconnu';
    const lieuShort = lieu.length > 38 ? lieu.substring(0, 36) + '…' : lieu;
    ctx.fillStyle = 'rgba(255,240,200,0.75)';
    ctx.font = '500 44px "Instrument Sans", sans-serif';
    ctx.fillText('📍 ' + lieuShort, W/2, H*0.67);

    // ── Date ─────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString(_currentLang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    ctx.fillStyle = 'rgba(168,180,255,0.45)';
    ctx.font = '36px "Instrument Sans", sans-serif';
    ctx.fillText(dateStr, W/2, H*0.74);

    // ── Coordonnées ───────────────────────────────────────
    if (selectedGhost.lat && selectedGhost.lng) {
      const lat = selectedGhost.lat.toFixed(4);
      const lng = selectedGhost.lng.toFixed(4);
      ctx.fillStyle = 'rgba(120,130,180,0.4)';
      ctx.font = '500 30px "Instrument Sans", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(`${lat}° N   ${lng}° E`, W/2, H*0.79);
      ctx.letterSpacing = '0px';
    }

    // Ligne déco bas
    ctx.strokeStyle = 'rgba(168,180,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, H - 160); ctx.lineTo(W - 80, H - 160); ctx.stroke();

    // CTA bas
    ctx.fillStyle = 'rgba(168,180,255,0.35)';
    ctx.font = '34px "Instrument Sans", sans-serif';
    ctx.fillText(_currentLang === 'en' ? 'Come discover what awaits you' : 'Viens découvrir ce qui t’attend', W/2, H - 108);
    ctx.fillStyle = 'rgba(168,180,255,0.2)';
    ctx.font = '28px "Instrument Sans", sans-serif';
    ctx.fillText('ghostub.app', W/2, H - 65);

    // ── Export ────────────────────────────────────────────
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
    if (btn) { btn.textContent = t.toast_copied; btn.style.borderColor = 'rgba(100,220,160,.4)'; setTimeout(() => { btn.textContent = t.share_copy_btn; btn.style.borderColor = ''; }, 2000); }
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
    } catch(e) {}
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
        const id = change.doc.id;
        const prev = parseInt(localStorage.getItem('prev_reso_' + id) || '0');
        const curr = g.resonances || 0;
        if (curr > prev) {
          const lieu = escapeHTML(g.location || 'ce lieu');
          const msg = _resoMessage(lieu, curr);
          showNotif(t.notif_reso_title, msg);
          showToast('info', msg, 5000);
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
      typedWrap.style.display = 'block';
      typedInput.value = '';
      btnOk.disabled = true;
      btnOk.style.opacity = '0.35';
      const onType = () => {
        const ok = typedInput.value.trim().toUpperCase() === 'SUPPRIMER';
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
      } catch(e) {}
    }

    await Promise.all([...dels, ...rDels, ...replyDelsOnMyGhosts]);
    const totalDel = snap.size + myReplies.size + replyDelsOnMyGhosts.length;
    btn.textContent = '✓ ' + snap.size + ' ' + (_currentLang === 'fr' ? 'fantômes supprimés' : 'ghosts deleted');
    btn.style.borderColor = 'rgba(100,220,160,.4)';
    btn.style.color = 'rgba(100,220,160,.9)';
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
  const btn = document.querySelector('[onclick="exportMyData()"]');
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
    showToast('error', 'Erreur export : ' + e.message);
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

window.loadNearbyGhosts = async () => {
  // Vérification offline
  if (!navigator.onLine) {
    showToast('warning', t.radar_offline);
  }
  const _gc = document.getElementById('ghostCount'); if (_gc) _gc.textContent = '';
  document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:13px;color:var(--spirit-dim)">' + t.radar_locating + '</span>';
  skeletonGhostList();
  try {
    await getLocation();
    document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:13px;color:var(--spirit-dim)">' + t.radar_searching + '</span>';
    window._gpsIsFallback = false;
    document.getElementById('userCoords').textContent =
      userLat.toFixed(4) + '° N, ' + userLng.toFixed(4) + '° E';
  } catch(e) {
    document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:12px;color:rgba(255,100,100,.6)">' + t.radar_no_gps + '</span>';
    // Utiliser la dernière position connue si disponible, sinon centre de France
    if (!userLat || !userLng) {
      userLat = 46.6034; userLng = 1.8883;
      window._gpsIsFallback = true;
    }
    // Si on a déjà une position réelle, on l'utilise sans marquer comme fallback
  }

  // ── QUERY FIRESTORE (géohash ~15km) ─────────────────────────────────
  // WorldService.getVisibleGhosts filtre par geohash (centre + 8 voisins ~15km)
  // → coût Firestore proportionnel à la zone, pas à la collection globale
  let snap;
  try {
    snap = await WorldService.getVisibleGhosts(userLat, userLng);
  } catch(firestoreErr) {
    console.error('Firestore error:', firestoreErr);
    showToast('error', t.radar_firestore_err || 'Erreur de chargement.');
    document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:12px;color:rgba(255,100,100,.6)">' + t.radar_firestore_err + '</span>';
    renderGhostList(); renderRadarDots(); return;
  }
  nearbyGhosts = [];
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
      if (window._gpsIsFallback || g.distance <= 5000) nearbyGhosts.push(g);
    }
  });
  nearbyGhosts.sort((a,b) => a.distance - b.distance);

  for (const g of nearbyGhosts) {
    if (g.secret) {
      const key = 'secret_revealed_' + g.id;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
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

  const count = nearbyGhosts.length;
  // Si 0 résultat et qu'il y a des fantômes en base, élargir à 50km
  let widened = false;
  if (count === 0 && snap.size > 0) {
    snap.forEach(d => {
      const g = { id: d.id, ...d.data() };
      if (g.expired || !g.lat || !g.lng) return;
      g.distance = distanceMeters(userLat, userLng, g.lat, g.lng);
      if (g.distance <= 50000) { nearbyGhosts.push(g); widened = true; }
    });
    nearbyGhosts.sort((a,b) => a.distance - b.distance);
  }
  if (count === 0) {
    if (widened && nearbyGhosts.length > 0) {
      document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:13px;color:var(--spirit-dim)">' + t.radar_no_ghosts_widened + '</span>';
    } else {
      document.querySelector('.ghost-count-line').innerHTML = '<span style="font-size:13px;color:var(--spirit-dim)">' + t.radar_no_ghosts + '</span>';
    }
  } else {
    document.querySelector('.ghost-count-line').innerHTML = '<span id="ghostCount">' + count + '</span> ' + (_currentLang === 'fr' ? ('fantôme' + (count > 1 ? 's' : '') + ' dans les alentours') : ('ghost' + (count > 1 ? 's' : '') + ' nearby'));
  }
  const mc = document.getElementById('mapCount');
  if (mc) mc.textContent = count + ' ' + (_currentLang === 'fr' ? 'fantôme(s)' : 'ghost(s)');
  if (map) { map.remove(); map = null; }
  renderGhostList();
  renderRadarDots();
  // Reconstruire la carte si l'écran carte est actif
  if (document.getElementById('screenMap')?.classList.contains('active')) {
    renderStaticMap();
  }
  const resoEl = document.getElementById('resoStatus');
  if (resoEl) {
    if (hasResonatedToday()) {
      resoEl.textContent = '✦ 0';
      resoEl.style.color = 'rgba(168,180,255,.25)';
      resoEl.style.borderColor = 'rgba(168,180,255,.08)';
    } else {
      resoEl.textContent = '✦ 1';
      resoEl.style.color = 'rgba(168,180,255,.7)';
      resoEl.style.borderColor = 'rgba(168,180,255,.3)';
    }
  }
  Analytics.track('ghosts_loaded', { count });
  checkForNewGhosts(count);
  // Notification fantôme jamais ouvert (3s après le chargement)
  setTimeout(() => checkVirginGhostNearby(), 3000);
  // Nettoyage des clés prev_reso_* orphelines (fantômes supprimés/expirés)
  cleanOldResoKeys();
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
    const noun = POETIC_NOUN_EN[(hash >> 4) % POETIC_NOUN_EN.length];
    const time = POETIC_TIME_EN[(hash >> 8) % POETIC_TIME_EN.length];
    return `The ${adj} ${noun} ${time}`;
  }
  const adj  = POETIC_ADJ[hash % POETIC_ADJ.length];
  const noun = POETIC_NOUN[(hash >> 4) % POETIC_NOUN.length];
  const time = POETIC_TIME[(hash >> 8) % POETIC_TIME.length];
  return `Le ${noun} ${adj} ${time}`;
}

// ── SONS ─────────────────────────────────────────────────
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
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
  } catch(e) {}
}
function _launchSealParticles() {
  const canvas = document.getElementById('sealParticles');
  if (!canvas) return;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const CX = W / 2, CY = H * 0.42;
  const COLORS = ['rgba(200,190,255,', 'rgba(168,180,255,', 'rgba(255,240,200,', 'rgba(220,200,255,', 'rgba(255,255,255,'];
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
  } catch(e) {}
}

function _launchDepositParticles() {
  const canvas = document.getElementById('sealParticles');
  if (!canvas) return;
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const CX = W / 2, CY = H / 2;
  // Couleurs dorées/vertes — ancrage, création
  const COLORS = ['rgba(255,210,80,', 'rgba(100,220,160,', 'rgba(255,240,150,', 'rgba(168,255,180,', 'rgba(255,255,200,'];
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
  btn.style.color = fav ? 'rgba(255,200,80,.9)' : 'rgba(255,200,80,.5)';
  btn.style.borderColor = fav ? 'rgba(255,200,80,.5)' : 'rgba(255,200,80,.2)';
  btn.style.background = fav ? 'rgba(255,200,80,.1)' : 'rgba(255,200,80,.05)';
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
    content.innerHTML = `<div style="opacity:.5;font-style:italic;">${t.misc_no_favorites || 'Aucun favori encore'}</div>`;
    return;
  }
  content.innerHTML = favs.map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:22px;flex-shrink:0;">${escapeHTML(f.emoji)}</span>
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="openGhost('${escapeHTML(f.id)}')">
        <div style="font-size:13px;color:var(--ether);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(f.location)}</div>
        <div style="font-size:11px;color:var(--spirit-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escapeHTML(f.message)}"</div>
      </div>
      <button onclick="removeFavorite('${escapeHTML(f.id)}')" aria-label="Retirer des favoris" style="background:none;border:none;color:rgba(255,200,80,.5);font-size:18px;cursor:pointer;flex-shrink:0;padding:4px;">★</button>
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
    content.innerHTML = `<div style="opacity:.5;font-style:italic;">${t.misc_no_favorites || 'Aucun favori encore'}</div>`;
  } else {
    content.innerHTML = favs.map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:22px;flex-shrink:0;">${escapeHTML(f.emoji)}</span>
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="openGhost('${escapeHTML(f.id)}')">
        <div style="font-size:13px;color:var(--ether);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(f.location)}</div>
        <div style="font-size:11px;color:var(--spirit-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escapeHTML(f.message)}"</div>
      </div>
      <button onclick="removeFavorite('${escapeHTML(f.id)}')" aria-label="Retirer des favoris" style="background:none;border:none;color:rgba(255,200,80,.5);font-size:18px;cursor:pointer;flex-shrink:0;padding:4px;">★</button>
    </div>`).join('');
  }
};

// ── CLASSEMENT PUBLIC ────────────────────────────────────

// ── CARTE EMPREINTE PERSONNELLE ──────────────────────────
let _empreinteMap = null;

window.loadEmpreinteMap = async () => {
  if (!currentUser) return;
  const container = document.getElementById('empreinteMap');
  const loader    = document.getElementById('empreinteLoader');
  const statsEl   = document.getElementById('empreinteStats');
  if (!container) return;

  // Reset
  if (_empreinteMap) { try { _empreinteMap.remove(); } catch(e){} _empreinteMap = null; }
  if (loader) loader.style.display = 'flex';

  // Charger Leaflet si pas encore disponible
  await new Promise((resolve) => {
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

  try {
    // 1. Charger les fantômes déposés par l'utilisateur
    const depositSnap = await getDocs(query(
      collection(db, COLL.GHOSTS),
      where('authorUid', '==', currentUser.uid),
      limit(100)
    ));
    const deposits = [];
    depositSnap.forEach(d => {
      const g = d.data();
      if (g.lat && g.lng) deposits.push({ lat: g.lat, lng: g.lng, emoji: g.emoji || '👻', location: g.location || '?', id: d.id });
    });

    // 2. Charger les fantômes découverts (depuis Firestore discoveries)
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
        } catch(e) {}
      }));
    }

    const allPoints = [...deposits, ...discoveries];
    if (loader) loader.style.display = 'none';

    if (allPoints.length === 0) {
      if (loader) loader.style.display = 'flex';
      loader.innerHTML = '<div style="font-size:32px;">👻</div><div style="font-size:12px;color:var(--spirit-dim);text-align:center;">' + t.profile_map_empty + '</div>';
      return;
    }

    // 3. Centrer la carte sur le barycentre des points
    const centerLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const centerLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;

    // Utiliser le div persistant (pas de innerHTML sur container)
    if (loader) loader.style.display = 'none';
    const leafletDiv = document.getElementById('empreinteLeaflet');
    leafletDiv.innerHTML = '';
    _empreinteMap = L.map('empreinteLeaflet', { zoomControl: false, attributionControl: false })
      .setView([centerLat, centerLng], deposits.length + discoveries.length > 5 ? 12 : 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(_empreinteMap);

    // 4. Marqueurs dépôts — violet lumineux
    deposits.forEach(p => {
      const icon = L.divIcon({
        html: `<div style="font-size:20px;filter:drop-shadow(0 0 8px rgba(168,180,255,1));animation:ghostFloat 2.5s ease-in-out infinite;">${p.emoji}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], className: ''
      });
      L.marker([p.lat, p.lng], { icon })
        .addTo(_empreinteMap)
        .bindPopup(`<div style="font-size:12px;font-family:'Instrument Sans',sans-serif;">👻 <b>${p.location}</b><br><span style="opacity:.6;font-size:10px;">Votre dépôt</span></div>`);
    });

    // 5. Marqueurs découvertes — doré
    discoveries.forEach(p => {
      const icon = L.divIcon({
        html: `<div style="width:10px;height:10px;background:rgba(255,200,80,.9);border-radius:50%;border:2px solid rgba(255,220,120,.8);box-shadow:0 0 8px rgba(255,200,80,.7);"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5], className: ''
      });
      L.marker([p.lat, p.lng], { icon })
        .addTo(_empreinteMap)
        .bindPopup(`<div style="font-size:12px;font-family:'Instrument Sans',sans-serif;">👁 <b>${p.location}</b><br><span style="opacity:.6;font-size:10px;">Découverte</span></div>`);
    });

    // Ajuster zoom pour tout voir
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
      _empreinteMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
    setTimeout(() => _empreinteMap.invalidateSize(), 300);

    // 6. Stats sous la carte
    const cities = new Set(allPoints.map(p => p.location.split(',')[0])).size;
    if (loader) loader.style.display = 'none';
    statsEl.innerHTML = `
      <div style="flex:1;background:rgba(10,10,20,.75);backdrop-filter:blur(6px);padding:8px 10px;text-align:center;border-right:1px solid rgba(168,180,255,.1);">
        <div style="font-size:16px;color:var(--ether);font-weight:600;">${deposits.length}</div>
        <div style="font-size:9px;color:var(--spirit-dim);letter-spacing:.5px;text-transform:uppercase;">${t.profile_map_deposits || 'Dépôts'}</div>
      </div>
      <div style="flex:1;background:rgba(10,10,20,.75);backdrop-filter:blur(6px);padding:8px 10px;text-align:center;border-right:1px solid rgba(168,180,255,.1);">
        <div style="font-size:16px;color:rgba(255,200,80,.9);font-weight:600;">${discoveries.length}</div>
        <div style="font-size:9px;color:var(--spirit-dim);letter-spacing:.5px;text-transform:uppercase;">${t.profile_map_discoveries || 'Découvertes'}</div>
      </div>
      <div style="flex:1;background:rgba(10,10,20,.75);backdrop-filter:blur(6px);padding:8px 10px;text-align:center;">
        <div style="font-size:16px;color:rgba(100,220,160,.9);font-weight:600;">${cities}</div>
        <div style="font-size:9px;color:var(--spirit-dim);letter-spacing:.5px;text-transform:uppercase;">${t.profile_map_places || 'Lieux'}</div>
      </div>`;

    // Afficher bouton partage si Web Share API dispo
    const shareBtn = document.getElementById('empreinteShareBtn');
    if (shareBtn && navigator.share) shareBtn.style.display = 'block';

  } catch(e) {
    console.error('Empreinte error:', e);
    if (loader) loader.style.display = 'none';
    if (loader) { loader.style.display = 'flex'; loader.innerHTML = `<div style="font-size:24px;">⚠️</div><div style="font-size:11px;color:var(--spirit-dim);">${t.profile_map_error || 'Impossible de charger'}</div>`; }
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
window.generateYearCard = async () => {
  const btn = document.getElementById('yearCardBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('italic 72px "Cormorant Garamond"'),
      document.fonts.load('500 36px "Instrument Sans"')
    ]);

    // Collecter les données
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
    } catch(e) {}

    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Fond ─────────────────────────────────────────────
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

    ctx.textAlign = 'center';

    // App name
    ctx.fillStyle = 'rgba(168,180,255,0.4)';
    ctx.font = '500 34px "Instrument Sans", sans-serif';
    ctx.fillText('GHOSTUB', W/2, 110);

    // Ligne déco
    ctx.strokeStyle = 'rgba(168,180,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80,140); ctx.lineTo(W-80,140); ctx.stroke();

    // Titre
    ctx.fillStyle = 'rgba(255,200,80,0.85)';
    ctx.font = 'italic 62px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(_currentLang === 'en' ? 'My year in ghosts' : 'Mon année en fantômes', W/2, 230);

    // Nom + rang
    ctx.fillStyle = 'rgba(230,225,255,0.9)';
    ctx.font = '500 44px "Instrument Sans", sans-serif';
    ctx.fillText(name, W/2, 310);
    ctx.fillStyle = 'rgba(168,180,255,0.5)';
    ctx.font = '34px "Instrument Sans", sans-serif';
    ctx.fillText(rank.icon + ' ' + rank.label, W/2, 370);

    // Ligne déco milieu
    ctx.strokeStyle = 'rgba(255,200,80,0.15)';
    ctx.beginPath(); ctx.moveTo(120,420); ctx.lineTo(W-120,420); ctx.stroke();

    // Stats grandes
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

      ctx.fillStyle = 'rgba(168,180,255,0.65)';
      ctx.font = 'italic 40px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(icon + '  ' + label, W/2, y+60);
    });

    // Extras
    ctx.strokeStyle = 'rgba(168,180,255,0.1)';
    ctx.beginPath(); ctx.moveTo(120,1080); ctx.lineTo(W-120,1080); ctx.stroke();

    const extras = [];
    if (streak >= 2) extras.push(`🔥 ${streak} jours de streak`);
    if (firstReads > 0) extras.push(`🥇 ${firstReads} premier${firstReads>1?'s':''} lecteur${firstReads>1?'s':''}`);
    if (topLocation) extras.push(`📍 ${topLocation.substring(0,30)}`);

    ctx.fillStyle = 'rgba(255,200,80,0.6)';
    ctx.font = '36px "Instrument Sans", sans-serif';
    extras.forEach((e, i) => ctx.fillText(e, W/2, 1160 + i*70));

    // Ligne bas
    ctx.strokeStyle = 'rgba(168,180,255,0.12)';
    ctx.beginPath(); ctx.moveTo(80,H-150); ctx.lineTo(W-80,H-150); ctx.stroke();

    // CTA
    ctx.fillStyle = 'rgba(168,180,255,0.35)';
    ctx.font = '32px "Instrument Sans", sans-serif';
    ctx.fillText(_currentLang === 'en' ? 'And you, what did you leave this year?' : 'Et toi, qu’est-ce que tu as laissé cette année ?', W/2, H-100);
    ctx.fillStyle = 'rgba(168,180,255,0.2)';
    ctx.font = '28px "Instrument Sans", sans-serif';
    ctx.fillText('ghostub.app', W/2, H-55);

    // Export
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
      if (btn) { btn.textContent = '❆ Mon année'; btn.disabled = false; }
    }, 'image/png');

  } catch(e) {
    console.warn('generateYearCard:', e);
    if (btn) { btn.textContent = '❆ Mon année'; btn.disabled = false; }
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
    <button onclick="document.getElementById('publicProfileModal').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:22px;color:rgba(168,180,255,.5);cursor:pointer;">✕</button>
    <div style="font-size:52px;margin-bottom:12px;">${initial}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-style:italic;color:var(--ether);margin-bottom:4px;">${escapeHTML(name)}</div>
    <div style="font-size:12px;color:var(--spirit-dim);margin-bottom:28px;">Chasseur de fantômes</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:340px;margin-bottom:24px;">
      <div style="background:var(--surface);border:1px solid rgba(168,180,255,.12);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--ether);">${ghostCount}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-top:4px;">${t.profile_stat_deposited_label || 'Fantômes déposés'}</div>
      </div>
      <div style="background:var(--surface);border:1px solid rgba(168,180,255,.12);border-radius:14px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--ether);">${totalOpens}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-top:4px;">${t.profile_stat_opens_label || 'Ouvertures totales'}</div>
      </div>
    </div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-bottom:12px;align-self:flex-start;max-width:340px;width:100%;">${t.profile_public_footprint || '🗺 Empreinte publique'}</div>
    <div id="publicEmpreinteMap" style="width:100%;max-width:340px;height:200px;border-radius:16px;overflow:hidden;border:1px solid rgba(168,180,255,.15);background:rgba(10,10,20,.8);margin-bottom:24px;"></div>
    <button onclick="window.location.href='https://pimpimshop33-dotcom.github.io/ghostub/'" style="background:linear-gradient(135deg,rgba(168,180,255,.18),rgba(168,180,255,.06));border:1px solid rgba(168,180,255,.35);border-radius:14px;color:rgba(168,180,255,.95);font-size:14px;padding:14px 24px;cursor:pointer;font-family:'Instrument Sans',sans-serif;width:100%;max-width:340px;">${t.profile_join_ghostub || '👻 Rejoindre Ghostub'}</button>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const mapEl = document.getElementById('publicEmpreinteMap');
    if (!mapEl || !ghostDocs.length) return;
    const coords = ghostDocs.filter(d => d.data().lat && d.data().lng).map(d => [d.data().lat, d.data().lng]);
    if (!coords.length) { mapEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:height:100%;font-size:12px;color:rgba(168,180,255,.4);">${t.profile_no_public_places || 'Aucun lieu public'}</div>`; return; }
    const pubMap = L.map('publicEmpreinteMap', { zoomControl: false, attributionControl: false }).setView(coords[0], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(pubMap);
    coords.forEach(([lat, lng], i) => {
      const g = ghostDocs[i] && ghostDocs[i].data ? ghostDocs[i].data() : {};
      const em = g.emoji || '👻';
      L.marker([lat, lng], { icon: L.divIcon({ html: '<div style="font-size:18px;">' + em + '</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(pubMap);
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
  el.innerHTML = `<div style="font-size:12px;color:var(--spirit-dim);">${t.loading || 'Chargement…'}</div>`;
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
      el.innerHTML = `<div style="font-size:12px;color:var(--spirit-dim);font-style:italic;">${t.profile_no_hunters || 'Aucun chasseur encore…'}</div>`;
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = sorted.map((s, i) => {
      const isMe = currentUser && s.name === (currentUser.displayName || currentUser.email);
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);${isMe ? 'background:rgba(168,180,255,.05);border-radius:8px;padding:7px 8px;margin:0 -8px;' : ''}">
        <span style="font-size:16px;width:22px;text-align:center;flex-shrink:0;">${medals[i] || (i+1)+'.'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:${isMe ? 'var(--ether)' : 'var(--warm-dim)'};font-weight:${isMe ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(s.name)}${isMe ? ' (' + (t.profile_you || 'vous') + ')' : ''}</div>
          <div style="font-size:11px;color:var(--spirit-dim);">${s.ghosts} ${_currentLang === 'fr' ? 'fantôme' + (s.ghosts > 1 ? 's' : '') : 'ghost' + (s.ghosts > 1 ? 's' : '')}</div>
        </div>
        <div style="font-size:13px;color:rgba(168,180,255,.7);flex-shrink:0;">✦ ${s.resonances}</div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="font-size:12px;color:var(--spirit-dim);">${t.profile_leaderboard_error || 'Impossible de charger le classement.'}</div>`;
  }
};

// ── FILTRES RADAR ────────────────────────────────────────
let activeFilter = 'all';

window.setFilter = (filter, btn) => {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGhostList();
  Analytics.track('filter_used', { filter });
};

function getFilteredGhosts() {
  switch (activeFilter) {
    case 'recent':
      return [...nearbyGhosts].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    case 'photo':
      return nearbyGhosts.filter(g => g.photoUrl);
    case 'audio':
      return nearbyGhosts.filter(g => g.audioUrl);
    case 'video':
      return nearbyGhosts.filter(g => g.videoUrl);
    default:
      return nearbyGhosts; // 'all' = tri par distance
  }
}

function renderGhostList() {
  const list = document.getElementById('ghostList');
  const filtered = getFilteredGhosts();
  if (nearbyGhosts.length === 0) {
    const isFirstTime = getDiscoveryCount() === 0;
    list.innerHTML = isFirstTime ? `
      <div style="text-align:center;padding:32px 16px 20px;">
        <div style="font-size:52px;margin-bottom:14px;animation:ghostFloat 2.8s ease-in-out infinite;">👻</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:var(--ether);margin-bottom:8px;">${t.radar_welcome_title}</div>
        <div style="font-size:13px;color:var(--warm-dim);line-height:1.65;margin-bottom:20px;">${t.radar_welcome_sub}</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:16px;text-align:left;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-bottom:10px;">${t.radar_how_title}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--warm-dim);">
              <span style="font-size:18px;">📍</span><span>${t.radar_how1}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--warm-dim);">
              <span style="font-size:18px;">🌫️</span><span>${t.radar_how2}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--warm-dim);">
              <span style="font-size:18px;">✉</span><span>${t.radar_how3}</span>
            </div>
          </div>
        </div>
        <button onclick="showScreen('screenDeposit');setNav('nav-deposit')" style="padding:12px 24px;background:linear-gradient(135deg,rgba(168,180,255,.2),rgba(168,180,255,.08));border:1px solid var(--border-bright);border-radius:20px;color:var(--ether);font-family:'Instrument Sans',sans-serif;font-size:14px;cursor:pointer;touch-action:manipulation;">${t.radar_first_btn}</button>
      </div>` : `
      <div style="text-align:center;padding:40px 0 20px;">
        <div style="font-size:48px;margin-bottom:12px;opacity:.4;filter:blur(1px);">👻</div>
        <div style="font-size:14px;color:var(--ether);font-family:'Cormorant Garamond',serif;font-style:italic;margin-bottom:6px;">${t.radar_empty_title}</div>
        <div style="font-size:12px;color:var(--spirit-dim);margin-bottom:20px;">${t.radar_empty_sub}</div>
        <button onclick="showScreen('screenDeposit');setNav('nav-deposit')" style="padding:10px 20px;background:linear-gradient(135deg,rgba(168,180,255,.18),rgba(168,180,255,.06));border:1px solid var(--border-bright);border-radius:20px;color:var(--ether);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer;touch-action:manipulation;">${t.radar_deposit_btn}</button>
      </div>`;
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px 0;font-size:13px;color:var(--spirit-dim);">${t.radar_filter_empty}</div>`;
    return;
  }
  list.innerHTML = filtered.map(g => {
    const emoji = g.secret ? '🔮' : (g.businessMode ? '🏪' : escapeHTML(g.emoji || '👻'));
    // Âge du fantôme
    const ageMs = g.createdAt ? Date.now() - g.createdAt.seconds * 1000 : 0;
    const ageDays = ageMs / 86400000;
    const isAncient = ageDays > 180;
    const isOld = ageDays > 30;
    const ageStyle = isAncient ? 'filter:sepia(.6) opacity(.85);' : isOld ? 'filter:sepia(.25) opacity(.92);' : '';
    const ageBadge = isAncient ? `<span style="font-size:9px;background:rgba(200,160,80,.12);border:1px solid rgba(200,160,80,.3);border-radius:20px;padding:1px 6px;color:rgba(200,160,80,.8);margin-left:4px;">${t.ghost_badge_archive}</span>`
                   : isOld ? `<span style="font-size:9px;background:rgba(168,180,255,.06);border:1px solid rgba(168,180,255,.15);border-radius:20px;padding:1px 6px;color:rgba(168,180,255,.4);margin-left:4px;">${t.ghost_badge_old}</span>` : '';
    // Résonances visuelles (étoiles)
    const resoCount = g.resonances || 0;
    const resoStars = resoCount > 0 ? '✦'.repeat(Math.min(resoCount, 5)) : '✦ 0';
    const resoStyle = resoCount >= 5 ? 'color:rgba(255,200,80,.9);text-shadow:0 0 8px rgba(255,200,80,.4);' : resoCount >= 2 ? 'color:rgba(168,180,255,.8);' : '';
    // Badge "jamais ouvert" — uniquement si déjà lu (pour ne pas doubler avec le hintText)
    const neverOpened = !g.openCount || g.openCount === 0;
    const virginBadge = ''; // supprimé — info déjà dans hintText
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
    return `
    <div class="ghost-envelope${g.secret ? ' ghost-envelope-secret' : ''}" style="${ageStyle}" onclick="openGhost('${escapeHTML(g.id)}')" role="button" tabindex="0" aria-label="Trace à ${escapeHTML(g.location || t.detail_location_unknown)}, ${formatDistance(g.distance)}" onkeydown="if(event.key==='Enter'||event.key===' ')openGhost('${escapeHTML(g.id)}')">
      <div class="envelope-flap" aria-hidden="true"><div class="envelope-flap-inner"></div></div>
      <div class="envelope-body">
        <div class="envelope-emoji" aria-hidden="true">${emoji}</div>
        <div class="envelope-content">
          <div class="envelope-location">📍 ${escapeHTML(g.location || t.detail_location_unknown)}${g.secret ? ' <span class="secret-badge" aria-label="Secret">SECRET</span>' : ''}${ageBadge}${virginBadge}</div>
          <div class="envelope-hint">${hintText}</div>
        </div>
        <div class="envelope-meta">
          <div class="envelope-dist" style="${
            g.distance <= 50  ? 'background:rgba(100,220,160,.1);border:1px solid rgba(100,220,160,.25);color:rgba(100,220,160,.9);' :
            g.distance <= 200 ? 'background:rgba(255,200,80,.08);border:1px solid rgba(255,200,80,.2);color:rgba(255,200,80,.8);' :
                                'background:rgba(168,180,255,.08);border:1px solid rgba(168,180,255,.12);color:rgba(168,180,255,.6);'
          }">${formatDistance(g.distance)}</div>
          <div class="envelope-reso" style="${resoStyle}" aria-label="${resoCount} résonances">${resoStars}</div>
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
}

function renderRadarDots() {
  const radar = document.getElementById('radarDots');
  radar.innerHTML = '';
  const maxDist = nearbyGhosts.length > 0 ? Math.max(...nearbyGhosts.slice(0,8).map(g => g.distance), 100) : 100;
  nearbyGhosts.slice(0,8).forEach((g, i) => {
    const angle = (i / Math.min(nearbyGhosts.length, 8)) * 2 * Math.PI - Math.PI / 2;
    const r = 15 + (g.distance / maxDist) * 29;
    const x = 50 + r * Math.cos(angle);
    const y = 50 + r * Math.sin(angle);
    const dot = document.createElement('div');
    dot.className = 'ghost-dot';
    dot.style.left = x + '%';
    dot.style.top = y + '%';
    dot.style.animationDelay = (i * 0.2) + 's';
    // Accessibilité : focusable + label
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `${escapeHTML(g.location || 'Fantôme')} — ${formatDistance(g.distance)}`);
    if (g.businessMode) {
      const bizBadge = document.createElement('div');
      bizBadge.textContent = '🏪';
      bizBadge.style.cssText = 'position:absolute;top:-8px;right:-8px;font-size:14px;filter:drop-shadow(0 0 4px rgba(255,200,80,.6));';
      dot.style.position = 'relative';
      dot.appendChild(bizBadge);
    }
    dot.onclick = () => openGhost(g.id);
    dot.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGhost(g.id); } };
    const emoji = g.secret ? '🔮' : (g.businessMode ? '🏪' : (g.emoji || '👻'));
    const label = escapeHTML(g.location || (_currentLang === 'en' ? 'Ghost' : 'Fantôme'));
    const sweepDuration = 4;
    const angleNorm = ((angle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const delay = -(angleNorm / (2 * Math.PI)) * sweepDuration;
    dot.innerHTML = `
      <div class="ghost-dot-emoji" style="animation-delay:${delay.toFixed(2)}s" aria-hidden="true">${emoji}</div>
      <div class="ghost-dot-inner" aria-hidden="true"></div>
      <div class="ghost-dot-label" aria-hidden="true">${label} · ${formatDistance(g.distance)}</div>
    `;
    radar.appendChild(dot);
  });
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
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      swipeGhost(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

window.openGhost = async (id) => {
  const idx = nearbyGhosts.findIndex(g => g.id === id);
  if (idx !== -1) currentGhostIndex = idx;
  selectedGhost = nearbyGhosts.find(g => g.id === id);
  // FIX: Ne PAS appeler addDiscovery ici — seulement quand l'enveloppe est RÉELLEMENT ouverte
  // (déplacé dans _doOpenEnvelope)
  WorldService.registerPresence(id, false).catch(() => {});

  if (!selectedGhost) {
    try {
      const docSnap = await getDoc(doc(db, COLL.GHOSTS, id));
      if (!docSnap.exists()) return;
      selectedGhost = { id: docSnap.id, ...docSnap.data(), distance: 0 };
    } catch(e) { return; }
  }

  document.getElementById('detailLocation').textContent = '📍 ' + escapeHTML(selectedGhost.location || t.detail_location_unknown);
  document.getElementById('sealedEmoji').textContent = selectedGhost.secret ? '🔮' : (selectedGhost.businessMode ? '🏪' : (selectedGhost.emoji || '👻'));
  const readCountEl = document.getElementById('detailReadCount');
  if (readCountEl) readCountEl.style.display = 'none';

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

  // ── Ghost dédié : vérifier si l'utilisateur est le destinataire ──
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
      return;
    }
  }
  // ── Vérifier la condition d'ouverture (sauf pour le propriétaire) ──
  resetBlockedOverlay();
  if (!isOwner) {
    const condCheck = isConditionMet(selectedGhost);
    if (!condCheck.ok) {
      showScreen('screenDetail');
      setNav('nav-radar');
      document.getElementById('detailLocation').textContent = '📍 ' + escapeHTML(selectedGhost.location || t.detail_location_unknown);
      showBlockedOverlay(condCheck);
      return;
    }
  }

  if (isLocked) {
    document.getElementById('detailMessage').textContent = t.ghost_secret_locked;
    document.getElementById('detailMessage').style.color = 'rgba(168,100,255,0.6)';
    document.getElementById('detailAudio').innerHTML = '';
    document.getElementById('detailPhoto').innerHTML = '';
    document.getElementById('resonanceBtn').style.display = 'none';
    document.getElementById('secretBtn').style.display = 'none';
    document.querySelector('#screenDetail .btn-secondary').style.display = 'none';
    const msgRBtnLocked = document.getElementById('msgReportBtn');
    if (msgRBtnLocked) msgRBtnLocked.style.display = 'none';
  } else {
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
      promoBlock.style.cssText = 'margin:16px 0 0;background:rgba(255,200,80,.08);border:1px solid rgba(255,200,80,.35);border-radius:14px;padding:14px 16px;text-align:center;';
      promoBlock.innerHTML =
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,200,80,.7);margin-bottom:8px;">&#x1F3EA; Offre exclusive</div>' +
        '<div style="font-size:20px;font-weight:700;color:rgba(255,200,80,.95);letter-spacing:1px;">' + escapeHTML(selectedGhost.promoCode) + '</div>' +
        '<div style="font-size:11px;color:var(--spirit-dim);margin-top:6px;">Présentez ce message en caisse pour en bénéficier</div>';
      document.getElementById('detailMessage').after(promoBlock);
    }
    document.getElementById('detailTime').textContent = '🕰 ' + timeAgo(selectedGhost.createdAt);
    document.getElementById('detailDuration').textContent = '⏳ ' + timeRemaining(selectedGhost);
    document.getElementById('detailRadius').textContent = '📡 ' + escapeHTML(selectedGhost.radius || '10m');

    // ── Mode Commerce : masquer Partager et Répondre ──
    const isBizGhost = !!selectedGhost.businessMode;
    const shareBtn2 = document.getElementById('ghostShareBtn');
    const replyBtn2 = document.getElementById('ghostReplyBtn');
    const resoBtn2  = document.getElementById('resonanceBtn');
    if (shareBtn2) shareBtn2.style.display = isBizGhost ? 'none' : '';
    if (replyBtn2) replyBtn2.style.display = isBizGhost ? 'none' : '';
    if (resoBtn2)  resoBtn2.style.display  = isBizGhost ? 'none' : '';

    const chainDiv = document.getElementById('detailChain');
    if (selectedGhost.chainHint || selectedGhost.chainLat) {
      chainDiv.style.display = 'block';
      chainDiv.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(168,180,255,.08),rgba(168,180,255,.03));border:1px solid rgba(168,180,255,.2);border-radius:16px;padding:14px 16px;margin-bottom:14px;">
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(168,180,255,.5);margin-bottom:8px;">🔗 La piste continue…</div>
          ${selectedGhost.chainHint ? `<div style="font-family:'Cormorant Garamond',serif;font-size:16px;font-style:italic;color:var(--ether);margin-bottom:10px;">"${escapeHTML(selectedGhost.chainHint)}"</div>` : ''}
          ${selectedGhost.chainLat ? `<button onclick="followChain()" style="width:100%;padding:10px;background:rgba(168,180,255,.1);border:1px solid rgba(168,180,255,.3);border-radius:12px;color:var(--ether);font-family:'Instrument Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .2s;">🗺 Suivre la piste →</button>` : ''}
        </div>`;
    } else {
      chainDiv.style.display = 'none';
    }

    const alreadyToday = hasResonatedToday();
    const resoBtn = document.getElementById('resonanceBtn');
    if (alreadyToday) {
      resoBtn.classList.add('resonated');
      resoBtn.textContent = t.detail_reso_used;
      resoBtn.style.borderColor = 'rgba(168,180,255,.2)';
      resoBtn.style.color = 'rgba(168,180,255,.4)';
      resoBtn.style.cursor = 'default';
    } else {
      resoBtn.classList.remove('resonated');
      resoBtn.style.borderColor = '';
      resoBtn.style.color = '';
      resoBtn.style.cursor = '';
      document.getElementById('resonanceCount').textContent = t.detail_reso_btn.replace('{n}', selectedGhost.resonances || 0);
    }

    const secretBtn = document.getElementById('secretBtn');
    if (isOwner && !selectedGhost.businessMode) {
      secretBtn.style.display = 'block';
      if (selectedGhost.secret) {
        secretBtn.textContent = t.dep_secret_on || '🔮 Mode secret activé';
        secretBtn.style.borderColor = 'rgba(168,100,255,.5)';
        secretBtn.style.color = 'rgba(200,150,255,.9)';
      } else {
        secretBtn.textContent = t.dep_secret_off || '🔮 Passer en secret';
        secretBtn.style.borderColor = '';
        secretBtn.style.color = '';
      }
    } else {
      secretBtn.style.display = 'none';
    }

    const audioEl = document.getElementById('detailAudio');
    if (selectedGhost.audioUrl) {
      audioEl.innerHTML = `
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-bottom:6px;">🎙 Message vocal</div>
          <audio controls src="${escapeHTML(selectedGhost.audioUrl)}" style="width:100%;border-radius:12px;" aria-label="Message vocal du fantôme"></audio>
        </div>`;
    } else { audioEl.innerHTML = ''; }

    const photoEl = document.getElementById('detailPhoto');
    if (selectedGhost.videoUrl) {
      photoEl.innerHTML = `
        <div style="margin-bottom:12px;position:relative;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-bottom:6px;">🎥 Vidéo</div>
          <div style="position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--border);">
            <video controls playsinline src="${escapeHTML(selectedGhost.videoUrl)}" style="width:100%;max-height:320px;display:block;background:#000;" aria-label="Vidéo du fantôme"></video>
            <button onclick="openReportModal()" aria-label="Signaler cette vidéo" title="Signaler cette vidéo" style="position:absolute;top:8px;right:8px;background:rgba(10,8,20,.75);backdrop-filter:blur(6px);border:1px solid rgba(255,100,100,.35);border-radius:10px;color:rgba(255,120,100,.9);font-size:12px;padding:5px 9px;cursor:pointer;font-family:'Instrument Sans',sans-serif;display:flex;align-items:center;gap:5px;touch-action:manipulation;transition:all .2s;">⚑ Signaler</button>
          </div>
        </div>`;
    } else if (selectedGhost.photoUrl) {
      photoEl.innerHTML = `
        <div style="margin-bottom:12px;position:relative;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--spirit-dim);margin-bottom:6px;">📷 Photo</div>
          <div style="position:relative;display:inline-block;width:100%;">
            <img src="${escapeHTML(selectedGhost.photoUrl)}" alt="Photo associée à ce fantôme" style="width:100%;border-radius:12px;border:1px solid var(--border);max-height:240px;object-fit:cover;display:block;" loading="lazy">
            <button onclick="openReportModal()" aria-label="Signaler cette photo comme inappropriée" title="Signaler cette photo" style="position:absolute;top:8px;right:8px;background:rgba(10,8,20,.75);backdrop-filter:blur(6px);border:1px solid rgba(255,100,100,.35);border-radius:10px;color:rgba(255,120,100,.9);font-size:12px;padding:5px 9px;cursor:pointer;font-family:'Instrument Sans',sans-serif;display:flex;align-items:center;gap:5px;touch-action:manipulation;transition:all .2s;" onmouseover="this.style.background='rgba(255,60,60,.18)'" onmouseout="this.style.background='rgba(10,8,20,.75)'">⚑ Signaler</button>
          </div>
        </div>`;
    } else { photoEl.innerHTML = ''; }
  }

  const repliesSnap = await getDocs(query(
    collection(db, COLL.REPLIES),
    where('ghostId', '==', id),
    orderBy('createdAt', 'desc')
  ));
  const repliesList = document.getElementById('repliesList');
  repliesList.innerHTML = '';
  if (repliesSnap.empty) {
    repliesList.innerHTML = '<div style="font-size:12px;color:var(--spirit-dim);padding:10px 0;">' + t.detail_no_replies_html + '</div>';
  } else {
    repliesSnap.forEach(d => {
      const r = d.data();
      repliesList.innerHTML += `
        <div class="reply-item">
          <div class="reply-text">"${escapeHTML(r.message)}"</div>
          <div class="reply-meta">${r.anonymous ? '👻 Anonyme' : escapeHTML(r.author)} · ${timeAgo(r.createdAt)}</div>
        </div>`;
    });
  }

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

async function canOpenToday() {
  if (isPremium) return true;
  if (!currentUser) return getDailyOpenCountLocal() < DAILY_OPEN_LIMIT; // fallback offline
  try {
    const ref = doc(db, 'userStats', currentUser.uid);
    const snap = await getDoc(ref);
    const count = snap.exists() ? (snap.data().dailyOpens?.[_todayKey()] || 0) : 0;
    return count < DAILY_OPEN_LIMIT;
  } catch(e) {
    // Si Firestore inaccessible, tomber sur le localStorage
    return getDailyOpenCountLocal() < DAILY_OPEN_LIMIT;
  }
}

async function incrementDailyOpenCount() {
  if (!currentUser) { _incrementLocal(); return; }
  const today = _todayKey();
  const ref = doc(db, 'userStats', currentUser.uid);
  try {
    await setDoc(ref, { dailyOpens: { [today]: increment(1) } }, { merge: true });
  } catch(e) {}
  _incrementLocal(); // toujours mettre à jour localement aussi
}

async function remainingOpensToday() {
  if (isPremium) return Infinity;
  if (!currentUser) return Math.max(0, DAILY_OPEN_LIMIT - getDailyOpenCountLocal());
  try {
    const ref = doc(db, 'userStats', currentUser.uid);
    const snap = await getDoc(ref);
    const count = snap.exists() ? (snap.data().dailyOpens?.[_todayKey()] || 0) : 0;
    return Math.max(0, DAILY_OPEN_LIMIT - count);
  } catch(e) {
    return Math.max(0, DAILY_OPEN_LIMIT - getDailyOpenCountLocal());
  }
}

// Helpers localStorage (cache local rapide)
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
  } catch(e) {}
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
    p.style.cssText = ['left:'+cx+'px','top:'+cy+'px','--px:'+px.toFixed(0)+'px','--py:'+py.toFixed(0)+'px','--dur:'+dur,'animation-delay:'+delay,'font-size:'+size+'px','color:rgba(168,180,255,'+alpha+')','filter:drop-shadow(0 0 4px rgba(168,180,255,.6))','line-height:1'].join(';');
    p.textContent = sym;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
  if (navigator.vibrate) navigator.vibrate([15, 10, 30]);
  btn.classList.add('firing');
  setTimeout(() => btn.classList.remove('firing'), 500);
}

window.resonate = async () => {
  const btn = document.getElementById('resonanceBtn');
  if (btn.classList.contains('resonated') || !selectedGhost) return;
  if (hasResonatedToday()) {
    btn.style.borderColor = 'rgba(255,180,50,.4)';
    btn.style.color = 'rgba(255,200,80,.8)';
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
  fireResonanceParticles(btn);
  btn.classList.add('resonated');
  btn.textContent = t.detail_reso_sent;
  markResonatedToday(selectedGhost.id);
  await updateDoc(doc(db, COLL.GHOSTS, selectedGhost.id), { resonances: increment(1) });
  // Compteur dénormalisé totalResonances sur l'auteur
  if (selectedGhost.authorUid) {
    setDoc(doc(db, COLL.USERS, selectedGhost.authorUid), { totalResonances: increment(1) }, { merge: true })
      .catch(e => console.warn('totalResonances increment:', e));
  }
  Analytics.track('resonate');
};

window.setChainMarker = () => {
  if (!userLat) { alert(t.toast_gps_req); return; }
  const preview = document.getElementById('chainMapPreview');
  preview.style.display = 'block';
  preview.innerHTML = '<div id="chainMiniMap" style="width:100%;height:120px;"></div>';
  const initChainMap = () => {
    const cmap = L.map('chainMiniMap', { zoomControl: false, attributionControl: false }).setView([userLat, userLng], 17);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(cmap);
    L.marker([userLat, userLng], { icon: L.divIcon({ html: '<div style="font-size:16px;">📍</div>', iconSize:[20,20], iconAnchor:[10,10], className:'' }) }).addTo(cmap);
    let nextMarker = null;
    cmap.on('click', e => {
      if (nextMarker) cmap.removeLayer(nextMarker);
      nextMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: L.divIcon({ html: '<div style="font-size:20px;filter:drop-shadow(0 0 8px rgba(168,180,255,.9));">🔗</div>', iconSize:[24,24], iconAnchor:[12,12], className:'' }) }).addTo(cmap);
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
      L.marker([selectedGhost.chainLat, selectedGhost.chainLng], { icon: L.divIcon({ html: '<div style="font-size:28px;filter:drop-shadow(0 0 12px rgba(168,180,255,.9));animation:floatG 2s ease-in-out infinite;">🔗</div>', iconSize:[32,32], iconAnchor:[16,32], className:'' }) }).addTo(window.map);
    }
  }, 800);
};

window.toggleSecret = async () => {
  if (!selectedGhost || !currentUser) return;
  if (selectedGhost.authorUid !== currentUser.uid) return;
  const nowSecret = !selectedGhost.secret;
  const btn = document.getElementById('secretBtn');
  btn.textContent = t.dep_pending || 'En cours…';
  await updateDoc(doc(db, COLL.GHOSTS, selectedGhost.id), {
    secret: nowSecret,
    radius: nowSecret ? '3m' : (selectedGhost.radius || '10m'),
    emoji: nowSecret ? '🔮' : '👻'
  });
  selectedGhost.secret = nowSecret;
  btn.textContent = nowSecret ? '🔮 Mode secret activé' : '🔮 Passer en secret';
  btn.style.borderColor = nowSecret ? 'rgba(168,100,255,.5)' : '';
  btn.style.color = nowSecret ? 'rgba(200,150,255,.9)' : '';
  document.getElementById('detailRadius').textContent = '📡 ' + (nowSecret ? '3m' : (selectedGhost.radius || '10m'));
};

window.depositGhost = async () => {
  const message  = document.getElementById('depositMsg').value.trim();
  const location = document.getElementById('depositLocation').value.trim();
  const rawEmoji  = document.getElementById('depositEmoji').value || '👻';
  // FIX: Limiter l'emoji à 2 caractères max pour éviter injection de HTML
  const emoji = [...rawEmoji].slice(0, 2).join('');
  const duration = document.querySelector('.dur-btn.active:not([data-maxopen])')?.textContent || t.dep_dur_7d;
  const maxOpenCount = parseInt(document.querySelector('.dur-btn.active[data-maxopen]')?.dataset.maxopen || '0');
  const radius   = document.querySelector('.radius-btn.active')?.textContent || '10m';
  const typeBtns = document.querySelectorAll('#screenDeposit .type-selector');
  const anon     = typeBtns[1]?.querySelector('.type-btn.active')?.dataset.val === 'anon';
  const secret   = typeBtns[0]?.querySelector('.type-btn.active')?.dataset.val === 'secret';
  const err      = document.getElementById('depositError');

  if (!message) { err.textContent = t.dep_err_msg; document.getElementById('depositMsg').focus(); return; }
  if (message.length > 280) { err.textContent = t.dep_err_long; return; }
  if (!userLat) {
    // Tenter une dernière fois
    try { await getLocation(); } catch(e) {}
    if (!userLat) { err.textContent = t.dep_err_gps; return; }
  }
  if (!navigator.onLine) { err.textContent = t.dep_err_offline; return; }

  err.textContent = '';
  // Vérification Premium serveur avant opération critique
  if (isPremium) await _verifyPremiumServer();
  // Cooldown : 0 pour Premium, 15min pour Free
  if (!isPremium) {
    const cooldownCheck = await WorldService.checkDepositCooldown(currentUser.uid, isExpired);
    if (!cooldownCheck.ok) { err.textContent = cooldownCheck.reason; return; }
  }
  const depositBtn = document.getElementById('depositBtn');
  const hasMedia = !!(window._pendingAudioBlob || window._pendingPhotoFile || window._pendingVideoFile);
  setLoading(depositBtn, true);
  depositBtn.textContent = hasMedia ? '⬆ Upload…' : '';

  try {
    const { audioUrl, photoUrl, videoUrl } = await uploadMedia(currentUser.uid + '_' + Date.now());
    if (hasMedia) depositBtn.textContent = t.dep_btn_saving;
    const chainHint = isPremium ? document.getElementById('chainHint').value.trim() : null;
    const chainNext = isPremium ? (window._chainNextCoords || null) : null;
    const openCondition = getSelectedCond();
    const openHour = openCondition === 'hour' ? document.getElementById('condHourInput').value : null;
    const openAfterGhostId = (openCondition === 'after' && isPremium) ? document.getElementById('condAfterInput').value.trim() : null;
    const openDate = openCondition === 'future' ? document.getElementById('condFutureInput').value : null;
    // ── Dépôt via WorldService.createGhost() ────────────────────────────
    const ghostData = {
      message, location: location || 'Lieu sans nom', emoji, duration, radius, maxOpenCount: maxOpenCount || 0,
      anonymous: anon, secret: secret || false,
      dedicatedTo: (isPremium && document.getElementById('dedicatedUidInput')?.value.trim()) || null,
      audioUrl: audioUrl || null, photoUrl: photoUrl || null, videoUrl: videoUrl || null,
      chainHint: (isPremium && chainHint) || null,
      chainLat: chainNext ? chainNext.lat : null,
      chainLng: chainNext ? chainNext.lng : null,
      openCondition: openCondition || 'always',
      openHour: openHour || null,
      openAfterGhostId: openAfterGhostId || null,
      openDate: openDate || null,
      businessMode: (isPremium && document.getElementById('businessExtra')?.style.display !== 'none') || false,
      promoCode: (isPremium && document.getElementById('businessExtra')?.style.display !== 'none') ? (document.getElementById('promoCode')?.value.trim() || null) : null,
    };
    const ghostId = await WorldService.createGhost(ghostData, userLat, userLng,
      { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email }
    );
    // Secours : forcer videoUrl dans Firestore si présent
    if (videoUrl && ghostId) {
      updateDoc(doc(db, COLL.GHOSTS, ghostId), { videoUrl }).catch(e => console.warn('videoUrl update:', e));
    }
    await WorldService.recordDepositTimestamp(currentUser.uid);
    // Compteur dénormalisé ghostCount
    setDoc(doc(db, COLL.USERS, currentUser.uid), { ghostCount: increment(1) }, { merge: true })
      .catch(e => console.warn('ghostCount increment:', e));
    document.getElementById('depositMsg').value = '';
    document.getElementById('depositLocation').value = '';
    document.getElementById('chainHint').value = '';
    const promoEl = document.getElementById('promoCode');
    if (promoEl) promoEl.value = '';
    const bizExtra = document.getElementById('businessExtra');
    if (bizExtra) bizExtra.style.display = 'none';
    const bizIcon = document.getElementById('businessToggleIcon');
    if (bizIcon) bizIcon.textContent = '○';
    const bizBtn = document.getElementById('businessToggleBtn');
    if (bizBtn) bizBtn.style.borderColor = 'rgba(255,200,80,.2)';
    document.getElementById('chainMapLabel').textContent = 'Placer le prochain point sur la carte';
    document.getElementById('chainMapPreview').style.display = 'none';
    window._chainNextCoords = null;
    depositBtn.textContent = t.dep_deposit_btn || '👻 Déposer le fantôme';
    depositBtn.disabled = false;
    clearAudio(); clearPhoto(); clearVideo();
    document.getElementById('depositSuccess').classList.add('show');
    // Ghost dédié sans UID : afficher le lien de partage
    if (isPremium && !document.getElementById('dedicatedUidInput')?.value.trim()) {
      const _dedEl = document.getElementById('successSubText');
      if (_dedEl && ghostId) {
        const _link = 'https://pimpimshop33-dotcom.github.io/ghostub/?ghost=' + ghostId + '&dedicated=1&ref=' + (currentUser.uid.slice(0,8));
        window._lastDedicatedLink = _link;
        _dedEl.innerHTML = 'Ton ghost est ancr\u00e9.<br><span style="font-size:11px;opacity:.7;">Partage ce lien pour le d\u00e9dier :</span><br><button onclick="navigator.clipboard.writeText(window._lastDedicatedLink).then(()=>showToast(\'link\',\'Lien copi\u00e9 !\'))" style="font-size:10px;color:rgba(168,180,255,.8);word-break:break-all;background:none;border:none;cursor:pointer;text-align:left;padding:4px 0;">' + _link + '</button>';
      }
    }
    // Incrémenter compteur cumulatif (persiste même si ghost supprimé/expiré)
    const _depKey = 'ghostub_total_deposited_' + (currentUser ? currentUser.uid : 'anon');
    localStorage.setItem(_depKey, (parseInt(localStorage.getItem(_depKey) || '0') + 1).toString());
    // Haptic ancrage : impact court + long vibration
    if (navigator.vibrate) navigator.vibrate([15, 40, 15, 40, 300]);
    // Particules dorées
    setTimeout(() => _launchDepositParticles(), 80);
    showToast('success', t.dep_success);
    // Notifier les utilisateurs qui ont des fantômes dans ce périmètre
    _notifyNearbyUsers(ghostId, userLat, userLng, location || 'ce lieu').catch(e => console.warn('notify:', e));
    playDepositSound();
    Analytics.track('ghost_deposited', { anonymous: anon, secret, hasAudio: !!audioUrl, hasPhoto: !!photoUrl });
    // Clic pour fermer manuellement si le timer bloque
    const successEl = document.getElementById('depositSuccess');
    const dismissSuccess = () => {
      successEl.classList.remove('show');
      successEl.removeEventListener('click', dismissSuccess);
      showScreen('screenRadar');
      setNav('nav-radar');
      // Délai pour laisser Firestore propager le nouveau fantôme
      setTimeout(() => loadNearbyGhosts().catch(() => {}), 1500);
    };
    successEl.addEventListener('click', dismissSuccess);
    setTimeout(() => dismissSuccess(), 2500);
  } catch(e) {
    err.textContent = t.dep_err_generic || 'Une erreur est survenue — vérifie ta connexion et réessaie.';
    console.warn('depositGhost error:', e);
    depositBtn.textContent = t.dep_deposit_btn || '👻 Ancrer ce fantôme';
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
    await addDoc(collection(db, COLL.REPLIES), {
      ghostId: selectedGhost.id,
      message: msg,
      anonymous: anon,
      author: currentUser.displayName || currentUser.email,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    // Notifier l'auteur du fantôme si ce n'est pas soi-même
    if (selectedGhost.authorUid && selectedGhost.authorUid !== currentUser.uid) {
      addDoc(collection(db, COLL.NOTIFS), {
        type: 'reply',
        toUid: selectedGhost.authorUid,
        ghostId: selectedGhost.id,
        ghostLocation: selectedGhost.location || t.detail_location_unknown,
        fromAuthor: anon ? '👻 Anonyme' : (currentUser.displayName || 'Quelqu\'un'),
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

async function _doOpenEnvelope() {
  // Incrémenter le compteur journalier (Firestore)
  if (!isPremium) await incrementDailyOpenCount();
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
          readCountEl.innerHTML = `<span style="color:rgba(100,220,160,.9);">${t.detail_first_reader || '🥇 Vous êtes le premier à lire ce message'}</span>`;
        } else {
          const prev = selectedGhost.openCount || 0;
          readCountEl.innerHTML = `<span style="color:var(--spirit-dim);">${_currentLang === 'fr' ? '👁 ' + prev + ' personne' + (prev > 1 ? 's ont' : ' a') + ' lu ce message avant vous' : '👁 ' + prev + ' person' + (prev > 1 ? 's' : '') + ' read this before you'}</span>`;
        }
        readCountEl.style.display = 'block';
      }

      if (wasFirst) showToast('success', t.detail_first_toast, 4000);
      updateDoc(doc(db, COLL.GHOSTS, selectedGhost.id), {
        openCount: increment(1),
        ...(nowExpired ? { expired: true } : {})
      }).catch(() => {
        // Si règles Firestore bloquent (non-auteur), fallback vers ghostStats
        setDoc(doc(db, 'ghostStats', selectedGhost.id), {
          openCount: increment(1),
          ghostId: selectedGhost.id,
          authorUid: selectedGhost.authorUid || null
        }, { merge: true }).catch(() => {});
      });
      if (nowExpired) showToast('info', t.detail_expired_last, 5000);
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
  if (navigator.vibrate) navigator.vibrate([10, 30, 20, 40, 10, 30, 250]);
  // ── FLASH plein écran ───────────────────────────────────
  const flash = document.getElementById('sealBreakFlash');
  if (flash) {
    flash.style.animation = 'none';
    flash.offsetHeight; // reflow
    flash.style.animation = 'sealFlash 0.9s ease-out forwards';
  }
  // ── PARTICULES ──────────────────────────────────────────
  _launchSealParticles();
  // ── ANIMATION ENVELOPPE ─────────────────────────────────
  sealed.classList.add('opening');
  setTimeout(() => {
    sealed.classList.add('opened');
    setTimeout(() => {
      sealed.style.display = 'none';
      revealed.style.display = 'block';
      revealed.classList.add('envelope-reveal');
      playRevealSound();
      // Vibration finale douce
      setTimeout(() => { if (navigator.vibrate) navigator.vibrate([20, 60, 20]); }, 200);
      // Apparition mot par mot — décalé après la fin de l'animation envelope-reveal (450ms)
      const msgEl = document.getElementById('detailMessage');
      if (msgEl && msgEl.textContent && msgEl.textContent.length > 1) {
        const fullText = msgEl.textContent;
        msgEl.textContent = '';
        msgEl.style.opacity = '0';
        setTimeout(() => {
          msgEl.style.opacity = '1';
          const words = fullText.split(' ');
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              msgEl.textContent += (i === 0 ? '' : ' ') + words[i];
              i++;
            } else {
              clearInterval(interval);
              if (navigator.vibrate) navigator.vibrate(40);
            }
          }, 80);
        }, 460);
      }
      const firstFocusable = revealed.querySelector('button, [tabindex]');
      if (firstFocusable) firstFocusable.focus();
    }, 350);
  }, 600);
  Analytics.track('envelope_opened');
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
  hint.innerHTML = `<span style="color:rgba(255,120,80,.9);font-size:13px;">🌫️ Le sceau résiste encore<br><span style="font-size:11px;opacity:.7;">encore ${meters}m à parcourir</span></span>`;
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
    icon.textContent = '🚫';
    document.getElementById('openLimitTitle').textContent = "Limite atteinte pour aujourd'hui";
    sub.innerHTML = t.open_limit_sub_reached.replace('{n}', DAILY_OPEN_LIMIT).replace('{s}','');
    okBtn.style.display = 'none';
    premium.style.display = 'block';
  } else {
    icon.textContent = remaining === 1 ? '⚠️' : '👻';
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
  if (!selectedGhost) return;
  // Vérifier si déjà ouvert (pas de vérif distance pour relecture)
  const revealed = document.getElementById('envelopeContent');
  if (revealed && revealed.style.display !== 'none') return; // déjà ouvert — ne pas reincrémenter

  // ── Vérifier limite journalière AVANT la distance ───────
  const remaining = await remainingOpensToday();
  if (!isPremium && (remaining <= 1)) {
    // Afficher l'avertissement, puis vérifier la distance si confirmé
    showOpenLimitWarning(remaining, (confirmed) => {
      if (!confirmed) return;
      if (remaining === 0) return; // bloqué
      _checkDistanceThenOpen();
    });
    return;
  }
  _checkDistanceThenOpen();
};

function _checkDistanceThenOpen() {
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
  }, 8000);

  if (!navigator.geolocation) {
    clearTimeout(fallbackTimer);
    btn.disabled = false;
    hint.textContent = t.env_gps_unavail;
    setTimeout(() => { hint.textContent = origHint; }, 4000);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
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
        _doOpenEnvelope();
      } else {
        showDistanceError(dist);
      }
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
          _doOpenEnvelope();
        } else {
          showDistanceError(dist);
        }
      } else {
        hint.textContent = t.env_gps_denied;
        setTimeout(() => { hint.textContent = origHint; }, 4000);
      }
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 5000 }
  );
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

window.showScreen = (id, fromPopstate = false) => {
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
    if (btn2)       { btn2.style.borderColor = 'rgba(255,200,80,.2)'; btn2.style.background = 'rgba(255,200,80,.06)'; }
    if (subLabel)   { subLabel.textContent = t.dep_biz_sub; subLabel.style.color = 'rgba(255,235,180,1)'; }
    // Reset step 2 sections
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id2 => {
      const el = document.getElementById(id2); if (el) el.style.display = '';
    });
    // Reset step 3 sections + titre + bouton
    ['step3IdentityWrap','step3VocalWrap',].forEach(id2 => {
      const el = document.getElementById(id2); if (el) el.style.display = '';
    });
    const t3 = document.getElementById('step3Title');
    const s3 = document.getElementById('step3Sub');
    const depBtn = document.getElementById('depositBtn');
    if (t3) t3.textContent = t.dep_pane3_title;
    if (s3) s3.textContent = t.dep_pane3_sub;
    if (depBtn) depBtn.textContent = t.dep_deposit_btn || '👻 Ancrer ce fantôme';
    // Reset champs bizTitle/bizDesc
    const bizTitle = document.getElementById('bizTitle');
    const bizDesc  = document.getElementById('bizDesc');
    if (bizTitle) bizTitle.value = '';
    if (bizDesc)  bizDesc.value  = '';
    // Reset condition d'ouverture
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    const alwaysBtn = document.querySelector('.cond-btn[data-cond="always"]');
    if (alwaysBtn) alwaysBtn.classList.add('active');
    document.getElementById('condExtraHour').classList.remove('show');
    document.getElementById('condExtraAfter').classList.remove('show');
    document.getElementById('condExtraFuture').classList.remove('show');
    const chainContent = document.getElementById('chainContent');
    const chainLock = document.getElementById('chainLock');
    const chainSection = document.getElementById();
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
};


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

  const activating = bizForm.style.display === 'none';

  if (activating) {
    // Remettre à l'étape 1 et scroller en haut
    if (typeof setWizardStep === 'function') setWizardStep(1);
    document.getElementById('screenDeposit')?.querySelector('.scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    // Basculer vers le formulaire Commerce
    normalForm.style.display = 'none';
    bizForm.style.display    = 'block';
    extra.style.display      = 'block'; // pour compatibilité depositGhost
    icon.textContent         = '●';
    btn.style.borderColor    = 'rgba(255,200,80,.6)';
    btn.style.background     = 'rgba(255,200,80,.1)';
    subLabel.textContent     = t.dep_biz_active;
    subLabel.style.color     = 'rgba(255,200,80,.7)';
    document.getElementById('depositEmoji').value = '🏪';
    // Masquer durée/disparaît/rayon/condition dans step 2
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Masquer identité/vocal/chaîne dans step 3, adapter titre
    ['step3IdentityWrap','step3VocalWrap',].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const t3 = document.getElementById('step3Title');
    const s3 = document.getElementById('step3Sub');
    if (t3) t3.textContent = t.dep_biz_visual_title || 'Ajouter un visuel';
    if (s3) s3.textContent = t.dep_biz_visual_sub || 'Photo ou vidéo pour illustrer votre offre (optionnel).';
    const depBtn = document.getElementById('depositBtn');
    if (depBtn) depBtn.textContent = t.dep_biz_deposit || '🏪 Publier cette offre';
    // Forcer durée 1 mois + rayon 50m
    setTimeout(() => {
      document.querySelectorAll('.dur-btn:not([data-maxopen])').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
        if (b.textContent.trim() === t.dep_dur_1m) {
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
    }, 100);
    showToast('success', t.dep_biz_toast);
  } else {
    // Retour au formulaire normal
    normalForm.style.display = 'block';
    bizForm.style.display    = 'none';
    extra.style.display      = 'none';
    icon.textContent         = '○';
    btn.style.borderColor    = 'rgba(255,200,80,.2)';
    btn.style.background     = 'rgba(255,200,80,.06)';
    subLabel.textContent     = t.dep_biz_sub;
    subLabel.style.color     = 'rgba(255,235,180,1)';
    // Réafficher les sections step 2
    ['step2DurWrap','step2MaxOpenWrap','step2RadiusWrap','step2CondWrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    // Réafficher les sections step 3
    ['step3IdentityWrap','step3VocalWrap',].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    const t3b = document.getElementById('step3Title');
    const s3b = document.getElementById('step3Sub');
    if (t3b) t3b.textContent = t.dep_pane3_title;
    if (s3b) s3b.textContent = t.dep_pane3_sub;
    const depBtnB = document.getElementById('depositBtn');
    if (depBtnB) depBtnB.textContent = t.dep_deposit_btn || '👻 Ancrer ce fantôme';
  }
};

window.selectCond = (btn) => {
  if (btn.dataset.cond === 'future' && !isPremium) {
    showToast('info', t.dep_cond_premium, 3500);
    return;
  }
  btn.closest('.cond-selector').querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
  // Vérif Premium pour "après un autre"
  if (btn.dataset.cond === 'after' && !isPremium) {
    showToast('info', t.dep_cond_premium, 3000);
    return;
  }
  btn.classList.add('active');
  const cond = btn.dataset.cond;
  document.getElementById('condExtraHour').classList.toggle('show', cond === 'hour');
  document.getElementById('condExtraAfter').classList.toggle('show', cond === 'after');
  document.getElementById('condExtraFuture').classList.toggle('show', cond === 'future');
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
    const reqId = ghost.openAfterGhostId;
    if (!reqId) return { ok: true };
    const already = getDiscoveredIds().includes(reqId);
    if (already) return { ok: true };
    return {
      ok: false,
      icon: '🔗',
      title: t.blocked_after_title,
      sub: t.blocked_after_sub,
      timer: null,
      timerLabel: null
    };
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
const _showScreenOrig = window.showScreen;
window.showScreen = (id, fromPopstate = false) => {
  animateScreenTransition(id);
  _showScreenOrig(id, fromPopstate);
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

  const getContainer = () => document.querySelector('#screenRadar .scroll');

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
    if (dy > MIN_PULL && !triggered) {
      triggered = true;
      spinner.classList.add('spin');
      if (txt) txt.textContent = t.misc_ptr_refreshing;
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
      loadNearbyGhosts().finally(() => {
        if (ind) ind.classList.remove('visible');
        if (spinner) spinner.classList.remove('spin');
        if (txt) txt.textContent = t.misc_ptr_release;
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

window.wizardNext = (step) => {
  if (step === 1) {
    const isBizMode = document.getElementById('businessDepositForm').style.display !== 'none';

    if (isBizMode) {
      // Validation mode Commerce : titre obligatoire
      const bizTitle = document.getElementById('bizTitle').value.trim();
      if (!bizTitle) {
        const el = document.getElementById('bizTitle');
        el.style.borderColor = 'rgba(255,100,100,.5)';
        setTimeout(() => el.style.borderColor = '', 1500);
        el.focus();
        showToast('warning', t.dep_biz_title_err);
        return;
      }
      // Construire le message auto depuis les champs commerce
      const bizType = document.querySelector('#bizTypeSelector .type-btn.active')?.dataset.val || 'Offre';
      const bizDesc = document.getElementById('bizDesc').value.trim();
      const promoCode = document.getElementById('promoCode').value.trim();
      let autoMsg = `🏪 ${bizType} : ${bizTitle}`;
      if (bizDesc) autoMsg += `\n${bizDesc}`;
      if (promoCode) autoMsg += `\nCode : ${promoCode}`;
      document.getElementById('depositMsg').value = autoMsg;
    } else {
      const msg = document.getElementById('depositMsg').value.trim();
      if (!msg) {
        document.getElementById('depositMsg').style.borderColor = 'rgba(255,100,100,.5)';
        document.getElementById('depositMsg').setAttribute('aria-invalid', 'true');
        setTimeout(() => {
          document.getElementById('depositMsg').style.borderColor = '';
          document.getElementById('depositMsg').removeAttribute('aria-invalid');
        }, 1500);
        document.getElementById('depositMsg').focus();
        return;
      }
      // Filtre anti-pub pour les non-premium
      if (!isPremium) {
        const spamWords = ['promo', 'soldes', 'remise', 'réduction', 'reduction', '% de', '% sur', 'gratuit', 'offre spéciale', 'offre speciale', 'achetez', 'commandez', 'livraison', 'prix', 'pas cher', 'discount', 'coupon', 'code promo'];
        const msgLower = msg.toLowerCase();
        if (spamWords.some(w => msgLower.includes(w))) {
          showToast('warning', '🏪 Pour les messages commerciaux, utilisez le Mode Commerce Premium.', 4000);
          document.getElementById('depositMsg').style.borderColor = 'rgba(255,200,80,.5)';
          setTimeout(() => document.getElementById('depositMsg').style.borderColor = '', 2000);
          return;
        }
      }
    }
    setWizardStep(2);
    // Auto-remplir le nom du lieu si vide
    const locInput = document.getElementById('depositLocation');
    if (userLat && !locInput.value) {
      locInput.placeholder = t.dep_loc_searching;
      reverseGeocode(userLat, userLng).then(name => {
        if (name && !locInput.value) {
          locInput.value = name;
          locInput.style.borderColor = 'rgba(100,220,160,.4)';
          setTimeout(() => locInput.style.borderColor = '', 1500);
        }
        locInput.placeholder = 'ex: Banc du parc, Café du coin…';
      });
    }
  } else if (step === 2) {
    // On suggère un nom de lieu mais ce n'est plus bloquant
    const loc = document.getElementById('depositLocation');
    if (!loc.value.trim()) {
      loc.value = 'Lieu sans nom';
    }
    setWizardStep(3);
    // Auto-remplir pseudo si connecté et champ vide
    const pseudoInput = document.getElementById('depositAuthor');
    if (pseudoInput && !pseudoInput.value && currentUser?.displayName) {
      pseudoInput.value = currentUser.displayName;
    }
  }
};

window.wizardBack = (step) => { setWizardStep(step - 1); };


// ── DEPOSIT MINI-MAP ─────────────────────────────────────
let _depositMiniMap = null;
let _depositRadiusCircle = null;

function _initDepositMiniMap() {
  if (!userLat || !userLng) return;
  const loader = document.getElementById('depositMiniLoader');
  const container = document.getElementById('depositMiniMap');
  if (!container) return;

  // Invalider si déjà initialisé (retour arrière)
  if (_depositMiniMap) {
    _depositMiniMap.invalidateSize();
    _depositMiniMap.setView([userLat, userLng], 17);
    _updateRadiusCircle();
    if (loader) loader.style.display = 'none';
    return;
  }

  _depositMiniMap = L.map('depositMiniMap', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false
  }).setView([userLat, userLng], 17);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  }).addTo(_depositMiniMap);

  // Marqueur position
  L.divIcon && L.marker([userLat, userLng], {
    icon: L.divIcon({
      html: '<div style="width:12px;height:12px;background:rgba(168,180,255,.9);border-radius:50%;border:2px solid rgba(255,255,255,.8);box-shadow:0 0 12px rgba(168,180,255,.7);"></div>',
      iconSize: [12, 12], iconAnchor: [6, 6], className: ''
    })
  }).addTo(_depositMiniMap);

  _updateRadiusCircle();
  if (loader) loader.style.display = 'none';
}

function _updateRadiusCircle() {
  if (!_depositMiniMap || !userLat || !userLng) return;
  const activeBtn = document.querySelector('.radius-btn.active');
  const radiusStr = activeBtn ? activeBtn.textContent : '10m';
  const radiusM = Math.max(3, parseInt(radiusStr) || 10);

  if (_depositRadiusCircle) _depositMiniMap.removeLayer(_depositRadiusCircle);
  _depositRadiusCircle = L.circle([userLat, userLng], {
    radius: radiusM,
    color: 'rgba(168,180,255,.8)',
    fillColor: 'rgba(168,180,255,.12)',
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
        if (len > 250) parent.classList.add('full');
        else if (len > 200) parent.classList.add('near');
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
  el.parentElement.querySelectorAll('.dur-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
};

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
  const syms = ['✦','✧','·','👻','✦','✦'];
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
    p.style.color = 'rgba(168,180,255,' + (0.4 + Math.random() * 0.6).toFixed(2) + ')';
    p.textContent = syms[i % syms.length];
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

window.goAuth = () => { localStorage.setItem('ghostub_onboard_seen', '1'); showScreen('screenAuth'); };

function createParticles() {
  const c = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.setAttribute('aria-hidden', 'true');
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 12) + 's';
    p.style.animationDelay    = (Math.random() * 10) + 's';
    c.appendChild(p);
  }
}
createParticles();

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
