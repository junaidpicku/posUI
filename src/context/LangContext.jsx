import React, { createContext, useContext, useState } from 'react';

const LangContext = createContext();

export const LANGS = {
  en: { label: '🇺🇸 English', short: 'EN' },
  hi: { label: '🇮🇳 हिंदी',   short: 'HI' },
  es: { label: '🇪🇸 Español', short: 'ES' },
};

export const T = {
  // ── Navigation
  browse_menu:      { en: 'Browse Menu',    hi: 'मेनू देखें',      es: 'Ver Menú'         },
  my_cart:          { en: 'My Cart',        hi: 'मेरी कार्ट',     es: 'Mi Carrito'       },
  track_order:      { en: 'Track Order',    hi: 'ऑर्डर ट्रैक',   es: 'Rastrear Pedido'  },
  order_history:    { en: 'Order History',  hi: 'ऑर्डर इतिहास',  es: 'Historial'        },
  my_profile:       { en: 'My Profile',     hi: 'मेरी प्रोफ़ाइल', es: 'Mi Perfil'        },
  support:          { en: 'Help & Support', hi: 'सहायता',          es: 'Ayuda'            },
  logout:           { en: 'Logout',         hi: 'लॉगआउट',          es: 'Cerrar Sesión'    },

  // ── Header
  allergens:        { en: 'Allergens',       hi: 'एलर्जेन',         es: 'Alérgenos'       },
  search_placeholder:{ en:'Search dishes, cuisines…', hi:'व्यंजन खोजें…', es:'Buscar platos…' },
  change:           { en: 'Change',          hi: 'बदलें',            es: 'Cambiar'          },
  dark_mode:        { en: 'Dark Mode',       hi: 'डार्क मोड',        es: 'Modo Oscuro'      },
  light_mode:       { en: 'Light Mode',      hi: 'लाइट मोड',         es: 'Modo Claro'       },

  // ── Categories
  all:              { en: 'All',             hi: 'सभी',              es: 'Todo'             },
  preference:       { en: 'Preference:',     hi: 'पसंद:',            es: 'Preferencia:'    },

  // ── Filter / Sort
  all_prices:       { en: 'All Prices',      hi: 'सभी मूल्य',        es: 'Todos Precios'    },
  sort_by:          { en: 'Sort By',         hi: 'क्रमबद्ध करें',   es: 'Ordenar Por'      },
  price_low:        { en: 'Price ↑',         hi: 'कम मूल्य',         es: 'Precio ↑'         },
  price_high:       { en: 'Price ↓',         hi: 'अधिक मूल्य',       es: 'Precio ↓'         },
  rating:           { en: 'Rating',          hi: 'रेटिंग',           es: 'Valoración'       },
  popular:          { en: 'Popular',         hi: 'लोकप्रिय',         es: 'Popular'          },
  clear:            { en: '✕ Clear',         hi: '✕ साफ़ करें',      es: '✕ Limpiar'        },
  items:            { en: 'items',           hi: 'आइटम',              es: 'artículos'        },

  // ── Menu cards
  add:              { en: '+ Add',           hi: '+ जोड़ें',          es: '+ Agregar'        },
  added:            { en: '✓ Added',         hi: '✓ जोड़ा',          es: '✓ Agregado'       },
  add_to_cart:      { en: 'Add to Cart',     hi: 'कार्ट में डालें', es: 'Agregar al Carrito'},
  added_to_cart:    { en: '✓ Added to Cart', hi: '✓ कार्ट में है',  es: '✓ En el Carrito'  },
  no_items:         { en: 'No items found',  hi: 'कोई आइटम नहीं',    es: 'Sin resultados'   },
  clear_filters:    { en: 'Clear Filters',   hi: 'फ़िल्टर हटाएं',   es: 'Quitar Filtros'   },
  popular_tag:      { en: '🔥 Popular',      hi: '🔥 लोकप्रिय',     es: '🔥 Popular'       },
  best_tag:         { en: '⭐ Best',         hi: '⭐ सर्वश्रेष्ठ',  es: '⭐ Mejor'         },
  chef_special:     { en: "Chef's Special",  hi: 'शेफ स्पेशल',       es: 'Especial del Chef'},
  most_ordered:     { en: 'Most Ordered',    hi: 'सबसे पसंदीदा',     es: 'Más Pedido'       },
  recommendations:  { en: "Chef's Recommendations", hi: 'शेफ की सिफारिशें', es: 'Recomendaciones' },
  disclaimer:       { en: 'Allergen Disclaimer',   hi: 'एलर्जी अस्वीकरण', es: 'Aviso de Alérgenos' },

  // ── Nutrition
  nutrition_facts:  { en: 'Nutrition Facts', hi: 'पोषण जानकारी',    es: 'Datos Nutricionales'},
  calories:         { en: 'cal',             hi: 'कैल',              es: 'cal'              },
  protein:          { en: 'protein',         hi: 'प्रोटीन',          es: 'proteína'         },
  carbs:            { en: 'carbs',           hi: 'कार्ब्स',          es: 'carbos'           },
  fat:              { en: 'fat',             hi: 'वसा',               es: 'grasas'           },
  fiber:            { en: 'fiber',           hi: 'फ़ाइबर',            es: 'fibra'            },
  sodium:           { en: 'sodium',          hi: 'सोडियम',            es: 'sodio'            },
  sugar:            { en: 'sugar',           hi: 'चीनी',              es: 'azúcar'           },

  // ── Cart
  your_order:       { en: 'Your Order',      hi: 'आपका ऑर्डर',       es: 'Tu Pedido'        },
  cart_empty:       { en: 'Your cart is empty', hi: 'कार्ट खाली है', es: 'Carrito vacío'    },
  add_something:    { en: 'Add something delicious!', hi: 'कुछ स्वादिष्ट जोड़ें!', es: '¡Agrega algo delicioso!' },
  total:            { en: 'Total',           hi: 'कुल',               es: 'Total'            },
  place_order:      { en: 'Place Order',     hi: 'ऑर्डर करें',       es: 'Hacer Pedido'     },
  view_cart:        { en: 'View Cart →',     hi: 'कार्ट देखें →',   es: 'Ver Carrito →'    },
  subtotal:         { en: 'Subtotal',        hi: 'उप-कुल',            es: 'Subtotal'         },

  // ── Change outlet
  change_selection: { en: 'Change Selection', hi: 'बदलाव करें',      es: 'Cambiar Selección'},
  change_outlet:    { en: 'Change Outlet',   hi: 'आउटलेट बदलें',    es: 'Cambiar Local'    },
  change_category:  { en: 'Change Category', hi: 'श्रेणी बदलें',    es: 'Cambiar Categoría'},

  // ── Login
  order_online:     { en: 'Order Online',    hi: 'ऑनलाइन ऑर्डर',   es: 'Pedir en Línea'   },
  login_subtitle:   { en: 'Enter your details to connect to your restaurant booking',
                      hi: 'अपना विवरण दर्ज करें',
                      es: 'Ingresa tus datos para conectarte'                               },
  hotel_id:         { en: 'Hotel ID',        hi: 'होटल आईडी',        es: 'ID del Hotel'     },
  room_number:      { en: 'Room Number',     hi: 'कमरा नंबर',        es: 'Número de Cuarto' },
  last_name:        { en: 'Last Name',       hi: 'उपनाम',             es: 'Apellido'         },
  login_btn:        { en: 'Login & Proceed', hi: 'लॉगिन करें',       es: 'Iniciar Sesión'   },
  contact_support:  { en: 'Contact support', hi: 'सहायता',            es: 'Soporte'          },
  need_help:        { en: 'Need help?',      hi: 'मदद चाहिए?',        es: '¿Necesitas ayuda?'},

  // ── Profile modal
  guest_name:       { en: 'Guest Name',      hi: 'अतिथि नाम',        es: 'Nombre'           },
  room_no:          { en: 'Room Number',     hi: 'कमरा नंबर',        es: 'Cuarto'           },
  current_outlet:   { en: 'Current Outlet',  hi: 'वर्तमान आउटलेट',  es: 'Local Actual'     },
  check_in:         { en: 'Check-in',        hi: 'चेक-इन',            es: 'Entrada'          },
  check_out:        { en: 'Check-out',       hi: 'चेक-आउट',          es: 'Salida'           },

  // ── History
  order_hist_title: { en: '📋 Order History',hi: '📋 ऑर्डर इतिहास', es: '📋 Historial'     },
  showing:          { en: 'Showing',         hi: 'दिखाया जा रहा है', es: 'Mostrando'        },
  orders:           { en: 'orders',          hi: 'ऑर्डर',             es: 'pedidos'          },
  order_num:        { en: 'Order #',         hi: 'ऑर्डर #',           es: 'Pedido #'         },
  date_time:        { en: 'Date/Time',       hi: 'तारीख/समय',         es: 'Fecha/Hora'       },
  no_orders:        { en: 'No orders yet',   hi: 'कोई ऑर्डर नहीं',   es: 'Sin pedidos'      },
  go_to_menu:       { en: 'Go to Menu',      hi: 'मेनू पर जाएं',    es: 'Ir al Menú'       },
  order_again:      { en: 'Order Again',     hi: 'फिर से ऑर्डर',    es: 'Pedir de Nuevo'   },

  // ── Misc
  room:             { en: 'Room',            hi: 'कमरा',              es: 'Cuarto'           },
  today:            { en: 'Today',           hi: 'आज',                es: 'Hoy'              },
};

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('pos_lang') || 'en');

  const setLanguage = (l) => {
    setLang(l);
    localStorage.setItem('pos_lang', l);
  };

  // t() — translate a key
  const t = (key) => T[key]?.[lang] || T[key]?.en || key;

  return (
    <LangContext.Provider value={{ lang, setLanguage, t, LANGS }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);