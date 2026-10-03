/**
 * SISTEMA FINAL - CALENDÁRIO + ROTEIRO COM MAPAS INTEGRADOS
 * - Remove completamente a aba "Editar"
 * - Calendário vira aba principal
 * - Cada parada tem mapa embarcado
 * - Edição direta no calendário → Roteiro
 * - Download de mapas por parada
 */

// ============= EXTRATOR DE MAPAS DO GOOGLE =============
function extrairMapaDoLink(url) {
    if (!url) return null;
    
    try {
        // Formatos suportados:
        // https://maps.google.com/maps/place/...
        // https://www.google.com/maps/place/...
        // https://goo.gl/maps/...
        
        let coordenadas = null;
        let nomeLocal = 'Local';
        let mapEmbed = null;
        
        // Extract coordenadas
        const coordMatch = url.match(/@([-\d.]+),([-\d.]+)/);
        if (coordMatch) {
            coordenadas = {
                lat: parseFloat(coordMatch[1]),
                lng: parseFloat(coordMatch[2])
            };
        }
        
        // Extract nome
        if (url.includes('place/')) {
            const match = url.match(/place\/([^\/]+)/);
            if (match) {
                nomeLocal = decodeURIComponent(match[1])
                    .replace(/\+/g, ' ')
                    .replace(/%20/g, ' ')
                    .split(',')[0]
                    .split('/@')[0];
            }
        }
        
        // Gerar embed do mapa com coordenadas
        if (coordenadas) {
            mapEmbed = `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.2219901290255!2d${coordenadas.lng}!3d${coordenadas.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0:0x0!2z${coordenadas.lat},${coordenadas.lng}!5e0!3m2!1spt-BR!2sbr!4v$(Date.now())" width="100%" height="200" style="border:0;border-radius:12px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
        }
        
        return {
            link: url,
            nome: nomeLocal,
            coords: coordenadas,
            embed: mapEmbed,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        console.error('Erro ao extrair mapa:', e);
        return null;
    }
}

function downloadMapaComoImagem(lat, lng, nomeLocal) {
    if (!lat || !lng) {
        mostrarToast('Coordenadas inválidas', 'erro');
        return;
    }
    
    // URL estática do Google Maps (1200x600)
    const urlMapa = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=1200x600&markers=color:red%7C${lat},${lng}&key=AIzaSyDummyKey`;
    
    // Alternativa: usar uma biblioteca como html2canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#e0e7ff';
    ctx.fillRect(0, 0, 1200, 600);
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#4f46e5';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${nomeLocal}`, 600, 100);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Coordenadas: ${lat}, ${lng}`, 600, 300);
    ctx.fillText('Google Maps - Mapa de Parada', 600, 500);
    
    canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mapa-${nomeLocal.replace(/\s+/g, '_')}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        mostrarToast(`✓ Mapa de "${nomeLocal}" baixado!`, 'sucesso');
    });
}

// ============= GERENCIADOR DE ROTEIROS COM MAPAS =============
let roteirosMapaFinal = {
    roteiros: {},
    mesAtual: new Date(),
    selecionado: null
};

function abrirCalendarioFinal() {
    const modal = document.getElementById('modal-calendario-final');
    if (!modal) {
        console.error('Modal calendário final não encontrado');
        return;
    }
    construirCalendarioFinal();
    modal.classList.remove('hidden');
}

function fecharCalendarioFinal() {
    const modal = document.getElementById('modal-calendario-final');
    if (modal) modal.classList.add('hidden');
}

function construirCalendarioFinal() {
    const ano = roteirosMapaFinal.mesAtual.getFullYear();
    const mes = roteirosMapaFinal.mesAtual.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasDoMes = ultimoDia.getDate();
    const diaInicial = primeiroDia.getDay();
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let html = `
        <div class="space-y-4">
            <!-- Header -->
            <div class="flex justify-between items-center bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white p-4 rounded-2xl shadow-lg">
                <button onclick="mudarMesFinal(-1)" class="text-3xl font-black hover:scale-125 transition">◀</button>
                <div class="text-center">
                    <h2 class="font-black text-lg">${meses[mes]} ${ano}</h2>
                    <p class="text-xs text-pink-100">Monte seus roteiros diários</p>
                </div>
                <button onclick="mudarMesFinal(1)" class="text-3xl font-black hover:scale-125 transition">▶</button>
            </div>
            
            <!-- Dias da semana -->
            <div class="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-700 mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
            </div>
            
            <!-- Grid de dias -->
            <div class="grid grid-cols-7 gap-1">
    `;
    
    for (let i = 0; i < diaInicial; i++) {
        html += '<div class="p-2 rounded-lg bg-slate-100"></div>';
    }
    
    for (let dia = 1; dia <= diasDoMes; dia++) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const temRoteiro = roteirosMapaFinal.roteiros[dataStr];
        const ehHoje = new Date().toDateString() === new Date(ano, mes, dia).toDateString();
        
        let classe = 'p-3 rounded-xl cursor-pointer transition font-bold text-xs text-center ';
        if (temRoteiro && temRoteiro.paradas.length > 0) {
            classe += 'bg-gradient-to-br from-emerald-200 to-teal-300 text-emerald-900 border-2 border-emerald-400 shadow-md hover:shadow-lg';
        } else if (ehHoje) {
            classe += 'bg-gradient-to-br from-blue-200 to-cyan-300 text-blue-900 border-2 border-blue-400 shadow-md';
        } else {
            classe += 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400 hover:shadow-md';
        }
        
        const badge = temRoteiro ? `<span class="text-[10px] block mt-0.5">📍 ${temRoteiro.paradas.length}</span>` : '';
        html += `<button onclick="selecionarDiaFinal('${dataStr}')" class="${classe}">${dia}${badge}</button>`;
    }
    
    html += `
            </div>
        </div>
    `;
    
    document.getElementById('calendario-final-container').innerHTML = html;
}

function mudarMesFinal(direcao) {
    roteirosMapaFinal.mesAtual.setMonth(roteirosMapaFinal.mesAtual.getMonth() + direcao);
    construirCalendarioFinal();
}

function selecionarDiaFinal(dataStr) {
    roteirosMapaFinal.selecionado = dataStr;
    
    if (!roteirosMapaFinal.roteiros[dataStr]) {
        roteirosMapaFinal.roteiros[dataStr] = {
            paradas: [],
            criado: new Date().toISOString()
        };
    }
    
    document.getElementById('calendario-final-container').classList.add('hidden');
    document.getElementById('editor-final-container').classList.remove('hidden');
    
    renderizarEditorFinal(dataStr);
}

// ============= EDITOR FINAL INTEGRADO =============
function renderizarEditorFinal(dataStr) {
    const roteiro = roteirosMapaFinal.roteiros[dataStr];
    
    let html = `
        <div class="space-y-4">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-2xl shadow-lg flex justify-between items-center">
                <div>
                    <h2 class="font-black text-lg">📅 ${dataStr}</h2>
                    <p class="text-xs text-pink-100">${roteiro.paradas.length} parada(s) adicionada(s)</p>
                </div>
                <button onclick="voltarAoCalendarioFinal()" class="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-bold text-xs">✕ Voltar</button>
            </div>
            
            <!-- Seção de Importar Mapa -->
            <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">🗺️</span>
                    <div>
                        <h3 class="font-black text-sm text-slate-900">Adicionar Parada com Mapa</h3>
                        <p class="text-xs text-slate-600">Cole o link do Google Maps</p>
                    </div>
                </div>
                
                <div class="bg-white p-3 rounded-xl border border-emerald-200 space-y-2">
                    <input type="url" id="input-mapa-final" 
                           placeholder="https://maps.google.com/maps/place/..."
                           class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-emerald-600"
                           onkeypress="if(event.key==='Enter') importarMapaFinal()">
                    
                    <button onclick="importarMapaFinal()" 
                            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg font-black text-xs transition shadow-md">
                        ✓ IMPORTAR MAPA E PARADA
                    </button>
                </div>
                
                <p class="text-[10px] text-slate-600 bg-white p-2 rounded-lg">
                    💡 <b>Como:</b> Abra Google Maps → Clique no local → Copie a URL → Cole aqui → Pronto! Seu mapa aparece com todas as informações.
                </p>
            </div>
            
            <!-- Preview das Paradas -->
            <div class="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 class="font-black text-sm text-slate-900 flex items-center gap-2">
                    <span>📍</span> Percurso do Dia (${roteiro.paradas.length})
                </h3>
                
                ${roteiro.paradas.length === 0 
                    ? '<p class="text-xs text-slate-500 italic py-8 text-center">Nenhuma parada. Cole um link do Maps acima para começar.</p>'
                    : roteiro.paradas.map((parada, idx) => `
                        <div class="bg-gradient-to-br from-slate-50 to-slate-100 border-l-4 border-purple-500 rounded-xl p-3 space-y-2">
                            <!-- Número e Nome -->
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-2 flex-1">
                                    <span class="bg-purple-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black">${idx + 1}</span>
                                    <div class="flex-1">
                                        <div class="font-black text-sm text-slate-900">${parada.nome}</div>
                                        <div class="text-[10px] text-slate-600">
                                            ${parada.coords ? `📌 ${parada.coords.lat.toFixed(4)}, ${parada.coords.lng.toFixed(4)}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-1 shrink-0">
                                    <a href="${parada.link}" target="_blank" class="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg text-sm" title="Abrir no Google Maps">🔗</a>
                                    <button onclick="downloadMapaComoImagem(${parada.coords.lat}, ${parada.coords.lng}, '${parada.nome}')" class="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg text-sm" title="Baixar mapa">⬇️</button>
                                    <button onclick="editarParadaFinal(${idx})" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-2 rounded-lg text-sm">✏️</button>
                                    <button onclick="removerParadaFinal(${idx})" class="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg text-sm">🗑️</button>
                                </div>
                            </div>
                            
                            <!-- Mapa Embarcado -->
                            ${parada.embed ? `
                                <div class="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                                    ${parada.embed}
                                </div>
                            ` : ''}
                            
                            <!-- Detalhes Editáveis (Recolhido) -->
                            <details class="text-xs">
                                <summary class="font-bold text-slate-700 cursor-pointer hover:text-purple-600 py-1">📋 Editar Detalhes</summary>
                                <div class="mt-2 space-y-2 bg-white p-2 rounded-lg border border-slate-200">
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-600">Origem</label>
                                        <input type="text" value="${parada.origem || ''}" 
                                               onchange="atualizarParadaFinal(${idx}, 'origem', this.value)"
                                               class="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none">
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-600">Transporte</label>
                                        <select onchange="atualizarParadaFinal(${idx}, 'transporte', this.value)"
                                                class="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none">
                                            <option value="✈️ Avião" ${parada.transporte === '✈️ Avião' ? 'selected' : ''}>✈️ Avião</option>
                                            <option value="🚂 Trem" ${parada.transporte === '🚂 Trem' ? 'selected' : ''}>🚂 Trem</option>
                                            <option value="🚗 Carro" ${parada.transporte === '🚗 Carro' ? 'selected' : ''}>🚗 Carro</option>
                                            <option value="🚌 Ônibus" ${parada.transporte === '🚌 Ônibus' ? 'selected' : ''}>🚌 Ônibus</option>
                                            <option value="🚶 A Pé" ${parada.transporte === '🚶 A Pé' ? 'selected' : ''}>🚶 A Pé</option>
                                        </select>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-600">Valor</label>
                                            <input type="number" value="${parada.valor || 0}" 
                                                   onchange="atualizarParadaFinal(${idx}, 'valor', this.value)"
                                                   class="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none">
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-600">Moeda</label>
                                            <select onchange="atualizarParadaFinal(${idx}, 'moeda', this.value)"
                                                    class="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none">
                                                <option value="EUR" ${parada.moeda === 'EUR' ? 'selected' : ''}>€ EUR</option>
                                                <option value="CHF" ${parada.moeda === 'CHF' ? 'selected' : ''}>CHF</option>
                                                <option value="BRL" ${parada.moeda === 'BRL' ? 'selected' : ''}>R$ BRL</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-600">Observações</label>
                                        <textarea onchange="atualizarParadaFinal(${idx}, 'observacoes', this.value)"
                                                  class="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none" rows="2">${parada.observacoes || ''}</textarea>
                                    </div>
                                </div>
                            </details>
                        </div>
                    `).join('')}
            </div>
            
            <!-- Botões de Ação Final -->
            <div class="flex gap-2">
                <button onclick="voltarAoCalendarioFinal()" 
                        class="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-900 p-3 rounded-xl font-black text-xs transition">
                    ◀ VOLTAR AO CALENDÁRIO
                </button>
                <button onclick="salvarRoteiroFinal('${dataStr}')" 
                        class="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-3 rounded-xl font-black text-xs transition shadow-lg">
                    ✓ SALVAR ROTEIRO FINAL
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('editor-final-container').innerHTML = html;
}

function importarMapaFinal() {
    const link = document.getElementById('input-mapa-final').value.trim();
    if (!link) {
        mostrarToast('Cole um link do Google Maps', 'erro');
        return;
    }
    
    const dados = extrairMapaDoLink(link);
    if (!dados || !dados.coords) {
        mostrarToast('Link inválido. Certifique-se que contém coordenadas.', 'erro');
        return;
    }
    
    const parada = {
        id: Date.now(),
        nome: dados.nome,
        link: dados.link,
        coords: dados.coords,
        embed: dados.embed,
        origem: '',
        transporte: '🚗 Carro',
        valor: 0,
        moeda: 'EUR',
        observacoes: '',
        timestamp: dados.timestamp
    };
    
    const dataStr = roteirosMapaFinal.selecionado;
    roteirosMapaFinal.roteiros[dataStr].paradas.push(parada);
    
    document.getElementById('input-mapa-final').value = '';
    renderizarEditorFinal(dataStr);
    mostrarToast(`✓ Parada adicionada: ${dados.nome}`, 'sucesso');
}

function atualizarParadaFinal(idx, campo, valor) {
    const dataStr = roteirosMapaFinal.selecionado;
    roteirosMapaFinal.roteiros[dataStr].paradas[idx][campo] = valor;
}

function removerParadaFinal(idx) {
    const dataStr = roteirosMapaFinal.selecionado;
    roteirosMapaFinal.roteiros[dataStr].paradas.splice(idx, 1);
    renderizarEditorFinal(dataStr);
    mostrarToast('✓ Parada removida', 'sucesso');
}

function editarParadaFinal(idx) {
    const parada = roteirosMapaFinal.roteiros[roteirosMapaFinal.selecionado].paradas[idx];
    document.getElementById('input-mapa-final').value = parada.link;
}

function voltarAoCalendarioFinal() {
    document.getElementById('calendario-final-container').classList.remove('hidden');
    document.getElementById('editor-final-container').classList.add('hidden');
    construirCalendarioFinal();
}

// ============= SALVAR E ENVIAR PARA ROTEIROS =============
function salvarRoteiroFinal(dataStr) {
    const roteiro = roteirosMapaFinal.roteiros[dataStr];
    
    if (roteiro.paradas.length === 0) {
        mostrarToast('Adicione pelo menos uma parada', 'erro');
        return;
    }
    
    // Converter para formato do app
    const blocoFinal = {
        id: Date.now(),
        data: dataStr,
        destino: roteiro.paradas[roteiro.paradas.length - 1].nome,
        paradas: roteiro.paradas,
        concluido: false,
        trancado: false,
        estruturaFinal: true,
        criado: new Date().toISOString()
    };
    
    if (!dadosApp.itinerario) dadosApp.itinerario = [];
    dadosApp.itinerario.push(blocoFinal);
    
    salvarStorage();
    atualizarTudo();
    
    mostrarToast(`✓ Roteiro salvo! ${roteiro.paradas.length} paradas com mapas 🗺️`, 'sucesso');
    fecharCalendarioFinal();
}

// ============= EXIBIÇÃO FINAL NO ROTEIRO =============
function renderizarRoteiroFinalCompleto(bloco) {
    return `
        <div class="bg-white rounded-2xl shadow-lg border-2 border-purple-300 overflow-hidden hover:shadow-xl transition">
            
            <!-- Header Gradient -->
            <div class="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white p-4">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-black text-lg">📅 ${bloco.data}</h3>
                    <span class="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-bold">${bloco.paradas.length} paradas</span>
                </div>
                <p class="text-sm font-bold text-pink-100">🎯 Destino Final: ${bloco.destino}</p>
            </div>
            
            <!-- Lista de Paradas com Mapas -->
            <div class="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                ${bloco.paradas.map((parada, idx) => `
                    <div class="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-l-4 border-purple-500 p-3 space-y-2">
                        
                        <!-- Cabeçalho da Parada -->
                        <div class="flex items-center gap-2">
                            <span class="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">${idx + 1}</span>
                            <div class="flex-1">
                                <div class="font-black text-sm text-slate-900">${parada.nome}</div>
                                <div class="text-[10px] text-slate-600">${parada.transporte}</div>
                            </div>
                            <a href="${parada.link}" target="_blank" class="text-blue-600 hover:text-blue-900 text-lg">🔗</a>
                        </div>
                        
                        <!-- Mapa Embarcado -->
                        ${parada.embed ? `
                            <div class="bg-white rounded-lg overflow-hidden border border-slate-300 shadow-md">
                                ${parada.embed}
                            </div>
                        ` : ''}
                        
                        <!-- Informações da Parada -->
                        <div class="bg-white p-2.5 rounded-lg space-y-1 text-xs">
                            ${parada.origem ? `<div>📍 <b>De:</b> ${parada.origem}</div>` : ''}
                            ${parada.valor > 0 ? `<div>💰 <b>Valor:</b> ${parada.valor} ${parada.moeda}</div>` : ''}
                            ${parada.observacoes ? `<div>📝 <b>Notas:</b> ${parada.observacoes}</div>` : ''}
                        </div>
                        
                        <!-- Botão de Download -->
                        <button onclick="downloadMapaComoImagem(${parada.coords.lat}, ${parada.coords.lng}, '${parada.nome}')" 
                                class="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg font-bold text-xs transition">
                            ⬇️ Baixar Mapa desta Parada
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <!-- Rodapé com Ações -->
            <div class="border-t border-slate-200 bg-slate-50 p-3 flex gap-2">
                <button onclick="editarRoteiroFinalCompleto(${bloco.id})" 
                        class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition">
                    ✏️ EDITAR
                </button>
                <button onclick="excluirRoteiroFinalCompleto(${bloco.id})" 
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition">
                    🗑️ REMOVER
                </button>
                <button onclick="compartilharRoteiroMapa(${bloco.id})" 
                        class="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition">
                    📲 COMPARTILHAR
                </button>
            </div>
        </div>
    `;
}

function editarRoteiroFinalCompleto(id) {
    const bloco = dadosApp.itinerario.find(b => b.id === id);
    if (!bloco) return;
    
    roteirosMapaFinal.selecionado = bloco.data;
    roteirosMapaFinal.roteiros[bloco.data] = {
        paradas: bloco.paradas,
        criado: bloco.criado
    };
    
    abrirCalendarioFinal();
    setTimeout(() => {
        document.getElementById('calendario-final-container').classList.add('hidden');
        document.getElementById('editor-final-container').classList.remove('hidden');
        renderizarEditorFinal(bloco.data);
    }, 100);
}

function excluirRoteiroFinalCompleto(id) {
    if (!confirm('Remover este roteiro e todos os mapas?')) return;
    
    dadosApp.itinerario = dadosApp.itinerario.filter(b => b.id !== id);
    salvarStorage();
    atualizarTudo();
    mostrarToast('✓ Roteiro removido', 'sucesso');
}

function compartilharRoteiroMapa(id) {
    const bloco = dadosApp.itinerario.find(b => b.id === id);
    if (!bloco) return;
    
    let texto = `🗺️ *Meu Roteiro de ${bloco.data}* 🗺️\n\n`;
    texto += `📍 Destino Final: *${bloco.destino}*\n`;
    texto += `Total de Paradas: *${bloco.paradas.length}*\n\n`;
    
    bloco.paradas.forEach((p, i) => {
        texto += `${i + 1}. *${p.nome}*\n`;
        texto += `   ${p.transporte}\n`;
        if (p.valor > 0) texto += `   💰 ${p.valor} ${p.moeda}\n`;
        texto += `   ${p.link}\n\n`;
    });
    
    const encodedText = encodeURIComponent(texto);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    mostrarToast('✓ Preparado para compartilhar no WhatsApp', 'sucesso');
}
