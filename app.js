const App = (() => {
  let currentService = null;
  let extintores = [];
  let editingExtId = null;
  let ctxExtId = null;
  let confirmCb = null;

  function init() {
    DB.open().then(async () => {
      DB.setConfig('lastAccess', new Date().toISOString());
      const saved = await DB.getConfig('currentService');
      if (saved) {
        currentService = saved;
        extintores = await DB.getAllByIndex('extintores', 'servicoId', currentService.id);
        showServiceBanner();
        showExtForm();
        updateHeader();
        renderExtList();
      }
      setDataToday();
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.autocomplete-wrap')) {
        document.querySelectorAll('.autocomplete-list').forEach(l => l.classList.remove('show'));
      }
    });

    setupAutocomplete('extMarca', 'marcas');
    setupAutocomplete('extLocalizacao', 'localizacoes');
  }

  function setDataToday() {
    const d = document.getElementById('svcData');
    if (d && !d.value) {
      d.value = new Date().toISOString().split('T')[0];
    }
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function navigate(secId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(secId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-section="${secId}"]`).classList.add('active');
    if (secId === 'secPesquisa') loadSearchFilters();
    if (secId === 'secClientes') loadClientList();
  }

  function estadoLabel(e) {
    return { manutencao: 'Manutenção', carregamento: 'Carregamento', rejeitado: 'Rejeitado' }[e] || e;
  }

  // === AUTOCOMPLETE ===
  function setupAutocomplete(inputId, configKey) {
    const input = document.getElementById(inputId);
    const list = inputId === 'extMarca' ? document.getElementById('extMarcaList') : document.getElementById('extLocalizacaoList');
    input.addEventListener('input', async () => {
      const val = input.value.toLowerCase();
      const items = (await DB.getConfig(configKey)) || [];
      const filtered = items.filter(i => i.toLowerCase().includes(val));
      if (filtered.length === 0 || val === '') { list.classList.remove('show'); return; }
      list.innerHTML = filtered.map(i => `<div class="autocomplete-item" onclick="App.selectAutocomplete('${inputId}','${i.replace(/'/g, "\\'")}')">${i}</div>`).join('');
      list.classList.add('show');
    });
    input.addEventListener('focus', async () => {
      if (input.value) return;
      const items = (await DB.getConfig(configKey)) || [];
      if (items.length === 0) return;
      list.innerHTML = items.map(i => `<div class="autocomplete-item" onclick="App.selectAutocomplete('${inputId}','${i.replace(/'/g, "\\'")}')">${i}</div>`).join('');
      list.classList.add('show');
    });
  }

  function selectAutocomplete(inputId, value) {
    document.getElementById(inputId).value = value;
    const list = inputId === 'extMarca' ? document.getElementById('extMarcaList') : document.getElementById('extLocalizacaoList');
    list.classList.remove('show');
  }

  async function saveAutocompleteItem(configKey, value) {
    if (!value || !value.trim()) return;
    const items = (await DB.getConfig(configKey)) || [];
    if (!items.includes(value.trim())) {
      items.push(value.trim());
      items.sort();
      await DB.setConfig(configKey, items);
    }
  }

  // === SERVICE ===
  async function startService() {
    const nome = document.getElementById('svcCliente').value.trim();
    const morada = document.getElementById('svcMorada').value.trim();
    const telefone = document.getElementById('svcTelefone').value.trim();
    const data = document.getElementById('svcData').value;

    if (!nome) { toast('Insira o nome do cliente'); return; }
    if (!morada) { toast('Insira a morada'); return; }

    if (currentService) {
      const svc = await DB.get('servicos', currentService.id);
      if (svc) {
        showExtForm();
        updateHeader();
        renderExtList();
        return;
      }
    }

    const clienteId = await DB.add('clientes', { nome: nome.toUpperCase(), morada: morada.toUpperCase(), telefone });

    const servico = { clienteId, data, morada: morada.toUpperCase(), telefone, status: 'em_andamento', extCount: 0 };
    const id = await DB.add('servicos', servico);
    servico.id = id;
    currentService = servico;
    await DB.setConfig('currentService', currentService);
    extintores = [];

    document.getElementById('svcCliente').value = '';
    document.getElementById('svcMorada').value = '';
    document.getElementById('svcTelefone').value = '';

    showExtForm();
    updateHeader();
    renderExtList();
    toast('Serviço iniciado');
  }

  function showServiceBanner() {
    const b = document.getElementById('serviceBanner');
    b.style.display = 'flex';
    document.getElementById('bannerText').textContent = `Serviço #${currentService.id} em andamento`;
  }

  function hideServiceBanner() {
    document.getElementById('serviceBanner').style.display = 'none';
  }

  function continueService() {
    hideServiceBanner();
    navigate('secCadastro');
    showExtForm();
    updateHeader();
    renderExtList();
  }

  async function abandonService() {
    showConfirm('Abandonar Serviço', 'Os dados do serviço em andamento serão perdidos. Continuar?', async () => {
      if (currentService) {
        const exts = await DB.getAllByIndex('extintores', 'servicoId', currentService.id);
        for (const e of exts) await DB.del('extintores', e.id);
        await DB.del('servicos', currentService.id);
      }
      currentService = null;
      extintores = [];
      await DB.setConfig('currentService', null);
      hideServiceBanner();
      document.getElementById('extFormWrap').style.display = 'none';
      document.getElementById('serviceFormCard').style.display = '';
      updateHeader();
      toast('Serviço abandonado');
    });
  }

  async function updateHeader() {
    if (!currentService) {
      document.getElementById('hdrEmpresa').textContent = '—';
      document.getElementById('hdrMorada').textContent = '—';
      document.getElementById('hdrData').textContent = '—';
      document.getElementById('hdrNum').textContent = '—';
      return;
    }
    let cliente = null;
    if (currentService.clienteId) cliente = await DB.get('clientes', currentService.clienteId);
    document.getElementById('hdrEmpresa').textContent = cliente ? cliente.nome : 'Sem cliente';
    document.getElementById('hdrMorada').textContent = currentService.morada || cliente?.morada || '—';
    document.getElementById('hdrData').textContent = currentService.data ? new Date(currentService.data + 'T00:00:00').toLocaleDateString('pt-PT') : '—';
    document.getElementById('hdrNum').textContent = String(extintores.length + 1).padStart(3, '0');
  }

  function showExtForm() {
    document.getElementById('extFormWrap').style.display = '';
    document.getElementById('serviceFormCard').style.display = 'none';
    document.getElementById('extNumero').value = String(extintores.length + 1).padStart(3, '0');
  }

  // === EXTINGUISHERS ===
  async function saveExtinguisher() {
    if (!currentService) { toast('Inicie um serviço primeiro'); return; }
    const numero = document.getElementById('extNumero').value.trim();
    const marca = document.getElementById('extMarca').value.trim();
    const fabrico = document.getElementById('extFabrico').value.trim();
    const serie = document.getElementById('extSerie').value.trim();
    const carregamento = document.getElementById('extCarregamento').value.trim();
    const localizacao = document.getElementById('extLocalizacao').value.trim();
    const tipo = document.getElementById('extTipo').value;
    const peso = document.getElementById('extPeso').value.trim().toUpperCase();
    const estadoEl = document.querySelector('input[name="extEstado"]:checked');
    const obs = document.getElementById('extObs').value.trim();

    if (!numero) { toast('Insira o número'); return; }
    if (!tipo) { toast('Selecione o tipo de extintor'); return; }
    if (!estadoEl) { toast('Selecione o estado'); return; }

    // Format peso based on tipo
    let formattedPeso = peso;
    if (peso && !peso.endsWith('KG') && !peso.endsWith('LTS')) {
      if (tipo === 'PO' || tipo === 'CO2') {
        formattedPeso = peso + 'KG';
      } else if (tipo === 'AGUA') {
        formattedPeso = peso + 'LTS';
      }
    }

    const extData = {
      servicoId: currentService.id,
      numero,
      marca: marca.toUpperCase(),
      dataFabrico: fabrico,
      serie: serie.toUpperCase(),
      ultimoCarregamento: carregamento,
      localizacao: localizacao.toUpperCase(),
      tipo,
      peso: formattedPeso,
      estado: estadoEl.value,
      observacoes: obs.toUpperCase()
    };

    if (editingExtId) {
      extData.id = editingExtId;
      await DB.put('extintores', extData);
      const idx = extintores.findIndex(e => e.id === editingExtId);
      if (idx >= 0) extintores[idx] = extData;
      toast('Extintor atualizado');
      editingExtId = null;
    } else {
      const id = await DB.add('extintores', extData);
      extData.id = id;
      extintores.push(extData);
      currentService.extCount = extintores.length;
      await DB.put('servicos', currentService);
      await DB.setConfig('currentService', currentService);
      toast('Extintor guardado');
    }

    await saveAutocompleteItem('marcas', marca.toUpperCase());
    await saveAutocompleteItem('localizacoes', localizacao.toUpperCase());
    clearExtForm();
    renderExtList();
    updateHeader();
  }

  function clearExtForm() {
    document.getElementById('extMarca').value = '';
    document.getElementById('extFabrico').value = '';
    document.getElementById('extSerie').value = '';
    document.getElementById('extCarregamento').value = '';
    document.getElementById('extLocalizacao').value = '';
    document.getElementById('extTipo').value = '';
    document.getElementById('extPeso').value = '';
    document.getElementById('extObs').value = '';
    document.querySelectorAll('input[name="extEstado"]').forEach(r => r.checked = false);
    const nextNum = extintores.length > 0
      ? Math.max(...extintores.map(e => parseInt(e.numero) || 0)) + 1
      : 1;
    document.getElementById('extNumero').value = String(nextNum).padStart(3, '0');
    editingExtId = null;
  }

  function duplicateExtinguisher() {
    const estado = document.querySelector('input[name="extEstado"]:checked');
    document.getElementById('extNumero').value = String(extintores.length + 1).padStart(3, '0');
    document.getElementById('extSerie').value = '';
    if (estado) estado.checked = false;
    toast('Campos copiados. Verifique antes de guardar.');
  }

  function renderExtList() {
    const el = document.getElementById('extList');
    document.getElementById('extCount').textContent = extintores.length;
    if (extintores.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Nenhum extintor registado</p></div>';
      return;
    }
    el.innerHTML = extintores.map(e => `
      <div class="ext-item" onclick="App.showExtCtx(event, ${e.id})">
        <div class="ext-num">${e.numero}</div>
        <div class="ext-info">
          <div class="ext-marca">${e.marca || '—'} ${e.tipo ? '[' + e.tipo + ']' : ''} ${e.peso ? e.peso : ''}</div>
          <div class="ext-detail">Série: ${e.serie || '—'} · Fabrico: ${e.dataFabrico || '—'} · Carga: ${e.ultimoCarregamento || '—'} · ${e.localizacao || '—'}</div>
        </div>
        <span class="ext-badge ${e.estado}">${estadoLabel(e.estado)}</span>
      </div>
    `).join('');
  }

  // === CONTEXT MENU ===
  function showExtCtx(e, id) {
    e.stopPropagation();
    ctxExtId = id;
    const menu = document.getElementById('ctxMenu');
    const overlay = document.getElementById('ctxOverlay');
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + 170 > window.innerWidth) left = window.innerWidth - 170;
    if (top + 140 > window.innerHeight) top = rect.top - 140;
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.classList.add('show');
    overlay.classList.add('show');
  }

  function closeCtx() {
    document.getElementById('ctxMenu').classList.remove('show');
    document.getElementById('ctxOverlay').classList.remove('show');
  }

  function ctxEdit() {
    closeCtx();
    const ext = extintores.find(e => e.id === ctxExtId);
    if (!ext) return;
    editingExtId = ext.id;
    document.getElementById('extNumero').value = ext.numero;
    document.getElementById('extMarca').value = ext.marca || '';
    document.getElementById('extFabrico').value = ext.dataFabrico || '';
    document.getElementById('extSerie').value = ext.serie || '';
    document.getElementById('extCarregamento').value = ext.ultimoCarregamento || '';
    document.getElementById('extLocalizacao').value = ext.localizacao || '';
    document.getElementById('extTipo').value = ext.tipo || '';
    document.getElementById('extPeso').value = ext.peso || '';
    document.getElementById('extObs').value = ext.observacoes || '';
    const radio = document.querySelector(`input[name="extEstado"][value="${ext.estado}"]`);
    if (radio) radio.checked = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ctxDuplicate() {
    closeCtx();
    const ext = extintores.find(e => e.id === ctxExtId);
    if (!ext) return;
    document.getElementById('extMarca').value = ext.marca || '';
    document.getElementById('extFabrico').value = ext.dataFabrico || '';
    document.getElementById('extCarregamento').value = ext.ultimoCarregamento || '';
    document.getElementById('extLocalizacao').value = ext.localizacao || '';
    document.getElementById('extTipo').value = ext.tipo || '';
    document.getElementById('extSerie').value = '';
    document.getElementById('extPeso').value = ext.peso || '';
    document.getElementById('extObs').value = '';
    const radio = document.querySelector(`input[name="extEstado"][value="${ext.estado}"]`);
    if (radio) radio.checked = true;
    document.getElementById('extNumero').value = String(extintores.length + 1).padStart(3, '0');
    editingExtId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Dados copiados. Verifique antes de guardar.');
  }

  function ctxDelete() {
    closeCtx();
    showConfirm('Eliminar Extintor', 'Tem certeza que deseja eliminar este extintor?', async () => {
      await DB.del('extintores', ctxExtId);
      extintores = extintores.filter(e => e.id !== ctxExtId);
      currentService.extCount = extintores.length;
      await DB.put('servicos', currentService);
      await DB.setConfig('currentService', currentService);
      renderExtList();
      updateHeader();
      toast('Extintor eliminado');
    });
  }

  // === FINALIZE SERVICE ===
  async function finalizeService() {
    if (!currentService || extintores.length === 0) { toast('Sem extintores para finalizar'); return; }
    let cliente = null;
    if (currentService.clienteId) cliente = await DB.get('clientes', currentService.clienteId);
    const manut = extintores.filter(e => e.estado === 'manutencao').length;
    const carga = extintores.filter(e => e.estado === 'carregamento').length;
    const rej = extintores.filter(e => e.estado === 'rejeitado').length;

    const content = document.getElementById('finalizeContent');
    content.innerHTML = `
      <p style="margin-bottom:4px"><strong>${cliente ? cliente.nome : 'Sem cliente'}</strong></p>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:2px">${currentService.morada || cliente?.morada || ''}</p>
      ${cliente?.telefone ? '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:2px">Tel: ' + cliente.telefone + '</p>' : ''}
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">${currentService.data ? new Date(currentService.data + 'T00:00:00').toLocaleDateString('pt-PT') : '—'}</p>
      <div class="finalize-grid">
        <div class="finalize-item"><div class="fi-value">${extintores.length}</div><div class="fi-label">Total</div></div>
        <div class="finalize-item"><div class="fi-value" style="color:var(--info)">${manut}</div><div class="fi-label">Manutenção</div></div>
        <div class="finalize-item"><div class="fi-value" style="color:#e65100">${carga}</div><div class="fi-label">Carregamento</div></div>
        <div class="finalize-item"><div class="fi-value" style="color:var(--danger)">${rej}</div><div class="fi-label">Rejeitados</div></div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="App.finalizeAndClose()">GUARDAR E FECHAR</button>
      </div>
      <div class="btn-group" style="margin-top:8px">
        <button class="btn btn-success btn-block" onclick="App.newServiceAfterFinalize()">NOVO SERVIÇO</button>
      </div>
      <div class="export-bar" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" onclick="App.exportPDF()">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="App.exportTXT()">TXT</button>
        <button class="btn btn-success btn-sm" onclick="App.shareWhatsApp()">WhatsApp</button>
      </div>
    `;
    document.getElementById('finalizeModal').classList.add('show');
  }

  async function finalizeAndClose() {
    if (currentService) {
      currentService.status = 'concluido';
      currentService.extCount = extintores.length;
      await DB.put('servicos', currentService);
    }
    currentService = null;
    extintores = [];
    await DB.setConfig('currentService', null);
    document.getElementById('finalizeModal').classList.remove('show');
    document.getElementById('extFormWrap').style.display = 'none';
    document.getElementById('serviceFormCard').style.display = '';
    hideServiceBanner();
    updateHeader();
    setDataToday();
    toast('Serviço finalizado');
  }

  async function newServiceAfterFinalize() {
    if (currentService) {
      currentService.status = 'concluido';
      currentService.extCount = extintores.length;
      await DB.put('servicos', currentService);
    }
    currentService = null;
    extintores = [];
    await DB.setConfig('currentService', null);
    document.getElementById('finalizeModal').classList.remove('show');
    document.getElementById('extFormWrap').style.display = 'none';
    document.getElementById('serviceFormCard').style.display = '';
    hideServiceBanner();
    setDataToday();
    updateHeader();
  }

  // === CLIENT LIST (HISTORY) ===
  async function loadClientList() {
    const servicos = await DB.getAll('servicos');
    const clientes = await DB.getAll('clientes');
    const el = document.getElementById('clientList');
    const done = servicos.filter(s => s.status === 'concluido').sort((a, b) => b.data?.localeCompare(a.data));

    if (done.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏢</div><p>Nenhum serviço no histórico</p></div>';
      return;
    }

    el.innerHTML = await Promise.all(done.map(async s => {
      const cli = clientes.find(c => c.id === s.clienteId);
      const exts = await DB.getAllByIndex('extintores', 'servicoId', s.id);
      const manut = exts.filter(e => e.estado === 'manutencao').length;
      const carga = exts.filter(e => e.estado === 'carregamento').length;
      const rej = exts.filter(e => e.estado === 'rejeitado').length;
      return `
        <div class="history-item" onclick="App.showHistoryDetail(${s.id})">
          <div class="history-date">${cli ? cli.nome : 'Sem cliente'}</div>
          <div class="history-meta">${s.data ? new Date(s.data + 'T00:00:00').toLocaleDateString('pt-PT') : '—'} · ${exts.length} extintores${cli?.telefone ? ' · Tel: ' + cli.telefone : ''}</div>
          <div class="history-stats">
            <span style="color:var(--info)">${manut} Manut.</span>
            <span style="color:#e65100">${carga} Carga</span>
            <span style="color:var(--danger)">${rej} Rej.</span>
          </div>
        </div>
      `;
    })).then(html => html.join(''));
  }

  async function showHistoryDetail(svcId) {
    const svc = await DB.get('servicos', svcId);
    if (!svc) return;
    const cli = svc.clienteId ? await DB.get('clientes', svc.clienteId) : null;
    const exts = await DB.getAllByIndex('extintores', 'servicoId', svcId);
    const manut = exts.filter(e => e.estado === 'manutencao').length;
    const carga = exts.filter(e => e.estado === 'carregamento').length;
    const rej = exts.filter(e => e.estado === 'rejeitado').length;

     const el = document.getElementById('historyDetailContent');
     el.innerHTML = `
       <p style="font-weight:700;margin-bottom:4px">${cli ? cli.nome : 'Sem cliente'}</p>
       <p style="font-size:0.82rem;color:var(--text-secondary)">${svc.morada || cli?.morada || ''} · ${svc.data ? new Date(svc.data + 'T00:00:00').toLocaleDateString('pt-PT') : ''}</p>
       ${cli?.telefone ? '<p style="font-size:0.82rem;color:var(--text-secondary)">Tel: ' + cli.telefone + '</p>' : ''}
       <div class="finalize-grid" style="margin:12px 0">
         <div class="finalize-item"><div class="fi-value">${exts.length}</div><div class="fi-label">Total</div></div>
         <div class="finalize-item"><div class="fi-value" style="color:var(--info)">${manut}</div><div class="fi-label">Manutenção</div></div>
         <div class="finalize-item"><div class="fi-value" style="color:#e65100">${carga}</div><div class="fi-label">Carregamento</div></div>
         <div class="finalize-item"><div class="fi-value" style="color:var(--danger)">${rej}</div><div class="fi-label">Rejeitados</div></div>
       </div>
       <div style="margin-top:8px">
         ${exts.map(e => `
           <div class="ext-item" onclick="App.editExtFromHistory(${e.id})">
             <div class="ext-num">${e.numero}</div>
             <div class="ext-info">
               <div class="ext-marca">${e.marca || '—'} ${e.tipo ? '[' + e.tipo + ']' : ''} ${e.peso || ''}</div>
               <div class="ext-detail">Série: ${e.serie || '—'} · Fabrico: ${e.dataFabrico || '—'} · Carga: ${e.ultimoCarregamento || '—'} · ${e.localizacao || '—'}</div>
             </div>
             <span class="ext-badge ${e.estado}">${estadoLabel(e.estado)}</span>
           </div>
         `).join('')}
       </div>
     `;
     // Set dataset for editExtFromHistory to work
     el.dataset.svcId = svcId;
     // Show export buttons if there are extintores
     document.getElementById('historyExportBar').style.display = exts.length > 0 ? '' : 'none';
     document.getElementById('clientList').style.display = 'none';
     document.getElementById('historyDetail').style.display = '';
  }

  function backToHistory() {
    document.getElementById('historyDetail').style.display = 'none';
    document.getElementById('clientList').style.display = '';
  }

  // === SEARCH ===
  async function loadSearchFilters() {
    const clientes = await DB.getAll('clientes');
    const servicos = await DB.getAll('servicos');
    const exts = await DB.getAll('extintores');
    const marcas = [...new Set(exts.map(e => e.marca).filter(Boolean))].sort();

    const cliSelect = document.getElementById('pesqCliente');
    cliSelect.innerHTML = '<option value="">Todos os clientes</option>' +
      clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    const svcSelect = document.getElementById('pesqServico');
    svcSelect.innerHTML = '<option value="">Todos os serviços</option>' +
      servicos.filter(s => s.status === 'concluido').map(s => {
        const cli = clientes.find(c => c.id === s.clienteId);
        return `<option value="${s.id}">${s.data || '—'} — ${cli ? cli.nome : 'Sem cliente'}</option>`;
      }).join('');

    const marcaSelect = document.getElementById('pesqMarca');
    marcaSelect.innerHTML = '<option value="">Todas as marcas</option>' +
      marcas.map(m => `<option value="${m}">${m}</option>`).join('');
  }

   async function search() {
     // Require client selection before searching
     const clienteId = document.getElementById('pesqCliente').value;
     if (!clienteId) {
       toast('Selecione um cliente antes de pesquisar');
       return;
     }
     
     const texto = document.getElementById('pesqTexto').value.toLowerCase();
     const estado = document.getElementById('pesqEstado').value;
     const marca = document.getElementById('pesqMarca').value;
     const tipo = document.getElementById('pesqTipo').value;
     const servicoId = document.getElementById('pesqServico').value;
     const dataIni = document.getElementById('pesqDataIni').value;
     const dataFim = document.getElementById('pesqDataFim').value;

    let exts = await DB.getAll('extintores');
    const servicos = await DB.getAll('servicos');
    const clientes = await DB.getAll('clientes');

    if (clienteId) {
      const svcIds = servicos.filter(s => s.clienteId === parseInt(clienteId)).map(s => s.id);
      exts = exts.filter(e => svcIds.includes(e.servicoId));
    }
    if (servicoId) exts = exts.filter(e => e.servicoId === parseInt(servicoId));
    if (estado) exts = exts.filter(e => e.estado === estado);
    if (marca) exts = exts.filter(e => e.marca === marca);
    if (tipo) exts = exts.filter(e => e.tipo === tipo);
    if (texto) {
      exts = exts.filter(e =>
        (e.numero && e.numero.toLowerCase().includes(texto)) ||
        (e.marca && e.marca.toLowerCase().includes(texto)) ||
        (e.serie && e.serie.toLowerCase().includes(texto)) ||
        (e.localizacao && e.localizacao.toLowerCase().includes(texto)) ||
        (e.observacoes && e.observacoes.toLowerCase().includes(texto))
      );
    }
    if (dataIni || dataFim) {
      exts = exts.filter(e => {
        const svc = servicos.find(s => s.id === e.servicoId);
        if (!svc || !svc.data) return false;
        if (dataIni && svc.data < dataIni) return false;
        if (dataFim && svc.data > dataFim) return false;
        return true;
      });
    }

    document.getElementById('statTotal').textContent = exts.length;
    document.getElementById('statManut').textContent = exts.filter(e => e.estado === 'manutencao').length;
    document.getElementById('statCarga').textContent = exts.filter(e => e.estado === 'carregamento').length;
    document.getElementById('statRej').textContent = exts.filter(e => e.estado === 'rejeitado').length;
    document.getElementById('pesqCount').textContent = exts.length;
    document.getElementById('pesqExportBar').style.display = exts.length > 0 ? '' : 'none';

    const el = document.getElementById('pesqResults');
    if (exts.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>Nenhum resultado encontrado</p></div>';
      return;
    }

    el.innerHTML = exts.map(e => {
      const svc = servicos.find(s => s.id === e.servicoId);
      const cli = svc ? clientes.find(c => c.id === svc.clienteId) : null;
      return `
        <div class="ext-item" style="cursor:default">
          <div class="ext-num">${e.numero}</div>
          <div class="ext-info">
            <div class="ext-marca">${e.marca || '—'} ${e.tipo ? '[' + e.tipo + ']' : ''} ${e.peso || ''}${cli ? ' — ' + cli.nome : ''}</div>
            <div class="ext-detail">Série: ${e.serie || '—'} · Fabrico: ${e.dataFabrico || '—'} · Carga: ${e.ultimoCarregamento || '—'} · ${e.localizacao || '—'}</div>
          </div>
          <span class="ext-badge ${e.estado}">${estadoLabel(e.estado)}</span>
        </div>
      `;
    }).join('');

    window._lastSearchResults = exts;
    window._lastSearchServicos = servicos;
    window._lastSearchClientes = clientes;
  }

  // === PDF EXPORT ===
  async function exportPDF() {
    const data = await getExportData();
    if (!data) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Relatório - ${data.cliente}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
        h1{font-size:18px;color:#d32f2f;margin-bottom:4px}
        h2{font-size:14px;color:#666;margin:0 0 16px}
        .info{margin-bottom:16px;font-size:12px;line-height:1.6}
        .info strong{display:inline-block;width:100px}
        .stats{display:flex;gap:20px;margin:16px 0}
        .stat{text-align:center;padding:8px 16px;border:1px solid #ddd;border-radius:6px}
        .stat .num{font-size:24px;font-weight:800}
        .stat .lbl{font-size:10px;color:#666;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#d32f2f;color:white;padding:6px 8px;text-align:left;font-size:11px}
        td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px}
        tr:nth-child(even){background:#f9f9f9}
        .footer{margin-top:20px;font-size:10px;color:#999;text-align:center}
        @media print{body{padding:10px}}
      </style></head><body>
      <h1>MANUTENCAO DE EXTINTORES</h1>
      <h2>Relatorio de Servico</h2>
      <div class="info">
        <strong>Cliente:</strong> ${data.cliente}<br>
        <strong>Morada:</strong> ${data.morada}<br>
        ${data.telefone ? '<strong>Telefone:</strong> ' + data.telefone + '<br>' : ''}
        <strong>Data:</strong> ${data.data}<br>
        <strong>Total:</strong> ${data.total} extintores
      </div>
      <div class="stats">
        <div class="stat"><div class="num">${data.total}</div><div class="lbl">Total</div></div>
        <div class="stat"><div class="num" style="color:#1565c0">${data.manut}</div><div class="lbl">Manutencao</div></div>
        <div class="stat"><div class="num" style="color:#e65100">${data.carga}</div><div class="lbl">Carregamento</div></div>
        <div class="stat"><div class="num" style="color:#c62828">${data.rej}</div><div class="lbl">Rejeitados</div></div>
      </div>
      <table>
        <tr><th>No</th><th>Marca</th><th>Tipo</th><th>Peso</th><th>Fabrico</th><th>Serie</th><th>Ult. Carga</th><th>Localizacao</th><th>Estado</th><th>Obs.</th></tr>
        ${data.extintores.map(e => `<tr>
          <td>${e.numero}</td><td>${e.marca||''}</td><td>${e.tipo||''}</td><td>${e.peso||''}</td><td>${e.dataFabrico||''}</td>
          <td>${e.serie||''}</td><td>${e.ultimoCarregamento||''}</td><td>${e.localizacao||''}</td>
          <td>${estadoLabel(e.estado)}</td><td>${e.observacoes||''}</td>
        </tr>`).join('')}
      </table>
      <div class="footer">Gerado em ${new Date().toLocaleString('pt-PT')} — Manutencao de Extintores</div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    win.document.close();
  }

  // === TXT EXPORT ===
  async function exportTXT() {
    const data = await getExportData();
    if (!data) return;
    let txt = `MANUTENCAO DE EXTINTORES\n`;
    txt += `${'='.repeat(40)}\n\n`;
    txt += `Cliente: ${data.cliente}\n`;
    txt += `Morada: ${data.morada}\n`;
    if (data.telefone) txt += `Telefone: ${data.telefone}\n`;
    txt += `Data: ${data.data}\n`;
    txt += `Total: ${data.total} extintores\n\n`;
    txt += `Manutencao: ${data.manut}\n`;
    txt += `Carregamento: ${data.carga}\n`;
    txt += `Rejeitados: ${data.rej}\n\n`;
    txt += `${'='.repeat(40)}\n`;
    txt += `EXTINTORES\n`;
    txt += `${'='.repeat(40)}\n\n`;
    data.extintores.forEach(e => {
      txt += `No: ${e.numero}\n`;
      txt += `  Marca: ${e.marca || '—'}\n`;
      txt += `  Tipo: ${e.tipo || '—'}\n`;
      txt += `  Peso: ${e.peso || '—'}\n`;
      txt += `  Fabrico: ${e.dataFabrico || '—'}\n`;
      txt += `  Serie: ${e.serie || '—'}\n`;
      txt += `  Ult. Carga: ${e.ultimoCarregamento || '—'}\n`;
      txt += `  Localizacao: ${e.localizacao || '—'}\n`;
      txt += `  Estado: ${estadoLabel(e.estado)}\n`;
      if (e.observacoes) txt += `  Obs.: ${e.observacoes}\n`;
      txt += '\n';
    });
    txt += `\nGerado em ${new Date().toLocaleString('pt-PT')}\n`;
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `servico_${data.cliente.replace(/\s+/g, '_')}_${data.data}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('TXT guardado');
  }

  async function getExportData() {
    let exts, svc, cli;
    if (window._lastSearchResults && window._lastSearchResults.length > 0) {
      exts = window._lastSearchResults;
      const servicos = window._lastSearchServicos || [];
      const clientes = window._lastSearchClientes || [];
      if (exts.length > 0) {
        svc = servicos.find(s => s.id === exts[0].servicoId) || { id: exts[0].servicoId };
        cli = svc ? clientes.find(c => c.id === svc.clienteId) : null;
      }
    } else if (extintores.length > 0 && currentService) {
      exts = extintores;
      svc = currentService;
      if (svc && svc.clienteId) cli = await DB.get('clientes', svc.clienteId);
    } else {
      toast('Sem dados para exportar');
      return null;
    }

    return {
      cliente: cli?.nome || 'Sem cliente',
      morada: svc?.morada || cli?.morada || '',
      telefone: cli?.telefone || svc?.telefone || '',
      data: svc?.data || '',
      total: exts.length,
      manut: exts.filter(e => e.estado === 'manutencao').length,
      carga: exts.filter(e => e.estado === 'carregamento').length,
      rej: exts.filter(e => e.estado === 'rejeitado').length,
      extintores: exts
    };
  }

  // === SHARE WHATSAPP ===
  async function shareWhatsApp() {
    const data = await getExportData();
    if (!data) return;
    let msg = `MANUTENCAO DE EXTINTORES\n\n`;
    msg += `*${data.cliente}*\n`;
    msg += `${data.morada}\n`;
    if (data.telefone) msg += `Tel: ${data.telefone}\n`;
    msg += `Data: ${data.data}\n\n`;
    msg += `Total: ${data.total}\n`;
    msg += `Manutencao: ${data.manut}\n`;
    msg += `Carregamento: ${data.carga}\n`;
    msg += `Rejeitados: ${data.rej}\n\n`;
    data.extintores.forEach(e => {
      msg += `${e.numero} — ${e.marca || '—'} ${e.tipo ? '[' + e.tipo + ']' : ''} ${e.peso || ''} — ${e.localizacao || '—'} — ${estadoLabel(e.estado)}\n`;
    });
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  // === EXPORT FROM HISTORY ===
  async function exportPDFFromHistory() {
    // Temporarily set last search results to the history detail data
    const svcId = document.getElementById('historyDetailContent').dataset.svcId;
    if (!svcId) return;
    
    const svc = await DB.get('servicos', parseInt(svcId));
    if (!svc) return;
    
    const exts = await DB.getAllByIndex('extintores', 'servicoId', svcId);
    const cli = svc.clienteId ? await DB.get('clientes', svc.clienteId) : null;
    
    // Set temporary search results for exportPDF to use
    window._lastSearchResults = exts;
    window._lastSearchServicos = [svc];
    window._lastSearchClientes = cli ? [cli] : [];
    
    await exportPDF();
    
    // Clean up temporary data
    window._lastSearchResults = null;
    window._lastSearchServicos = null;
    window._lastSearchClientes = null;
  }

  async function exportTXTFromHistory() {
    // Temporarily set last search results to the history detail data
    const svcId = document.getElementById('historyDetailContent').dataset.svcId;
    if (!svcId) return;
    
    const svc = await DB.get('servicos', parseInt(svcId));
    if (!svc) return;
    
    const exts = await DB.getAllByIndex('extintores', 'servicoId', svcId);
    const cli = svc.clienteId ? await DB.get('clientes', svc.clienteId) : null;
    
    // Set temporary search results for exportTXT to use
    window._lastSearchResults = exts;
    window._lastSearchServicos = [svc];
    window._lastSearchClientes = cli ? [cli] : [];
    
    await exportTXT();
    
    // Clean up temporary data
    window._lastSearchResults = null;
    window._lastSearchServicos = null;
    window._lastSearchClientes = null;
  }

   async function shareWhatsAppFromHistory() {
     // Temporarily set last search results to the history detail data
     const svcId = document.getElementById('historyDetailContent').dataset.svcId;
     if (!svcId) return;
     
     const svc = await DB.get('servicos', parseInt(svcId));
     if (!svc) return;
     
     const exts = await DB.getAllByIndex('extintores', 'servicoId', svcId);
     const cli = svc.clienteId ? await DB.get('clientes', svc.clienteId) : null;
     
     // Set temporary search results for shareWhatsApp to use
     window._lastSearchResults = exts;
     window._lastSearchServicos = [svc];
     window._lastSearchClientes = cli ? [cli] : [];
     
     await shareWhatsApp();
     
     // Clean up temporary data
     window._lastSearchResults = null;
     window._lastSearchServicos = null;
     window._lastSearchClientes = null;
   }

   async function editExtFromHistory(extId) {
     // Get the extintor from database
     const ext = await DB.get('extintores', extId);
     if (!ext) {
       toast('Extintor não encontrado');
       return;
     }
     
     // Set editing flag and populate form
     editingExtId = ext.id;
     
     // Populate form fields
     document.getElementById('extNumero').value = ext.numero;
     document.getElementById('extMarca').value = ext.marca || '';
     document.getElementById('extFabrico').value = ext.dataFabrico || '';
     document.getElementById('extSerie').value = ext.serie || '';
     document.getElementById('extCarregamento').value = ext.ultimoCarregamento || '';
     document.getElementById('extLocalizacao').value = ext.localizacao || '';
     document.getElementById('extTipo').value = ext.tipo || '';
     document.getElementById('extPeso').value = ext.peso || '';
     document.getElementById('extObs').value = ext.observacoes || '';
     const radio = document.querySelector(`input[name="extEstado"][value="${ext.estado}"]`);
     if (radio) radio.checked = true;
     
     // Switch to cadastro section and show form
     navigate('secCadastro');
     showExtForm();
     window.scrollTo({ top: 0, behavior: 'smooth' });
     
     toast('Editando extintor do histórico');
   }

  // === BACKUP ===
  async function exportBackup() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_manutext_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  }

  async function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    showConfirm('Importar Backup', 'Isto irá substituir TODOS os dados atuais. Continuar?', async () => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await DB.importAll(data);
        toast('Backup restaurado com sucesso');
        currentService = await DB.getConfig('currentService');
        if (currentService) {
          extintores = await DB.getAllByIndex('extintores', 'servicoId', currentService.id);
          showServiceBanner();
          showExtForm();
          updateHeader();
          renderExtList();
        } else {
          document.getElementById('extFormWrap').style.display = 'none';
          document.getElementById('serviceFormCard').style.display = '';
          updateHeader();
        }
      } catch (err) {
        toast('Erro ao importar backup');
      }
    });
    e.target.value = '';
  }

  async function clearAllData() {
    showConfirm('Apagar Todos os Dados', 'Esta ação é irreversível. Todos os clientes, serviços e extintores serão eliminados.', async () => {
      await DB.clearAll();
      currentService = null;
      extintores = [];
      hideServiceBanner();
      document.getElementById('extFormWrap').style.display = 'none';
      document.getElementById('serviceFormCard').style.display = '';
      updateHeader();
      toast('Todos os dados foram eliminados');
    });
  }

  // === CONFIRM DIALOG ===
  function showConfirm(title, msg, cb) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    confirmCb = cb;
    document.getElementById('confirmDialog').classList.add('show');
  }

  function confirmYes() {
    document.getElementById('confirmDialog').classList.remove('show');
    if (confirmCb) confirmCb();
    confirmCb = null;
  }

  function confirmNo() {
    document.getElementById('confirmDialog').classList.remove('show');
    confirmCb = null;
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('show');
  }

  // === SERVICE WORKER ===
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // === INIT ===
  document.addEventListener('DOMContentLoaded', init);

  return {
    navigate, startService, saveExtinguisher, duplicateExtinguisher,
    showExtCtx, closeCtx, ctxEdit, ctxDuplicate, ctxDelete,
    finalizeService, finalizeAndClose, newServiceAfterFinalize,
    search, exportPDF, exportTXT, shareWhatsApp, exportBackup, importBackup,
    clearAllData, confirmYes, confirmNo, closeModal,
    continueService, abandonService, selectAutocomplete,
    showHistoryDetail, backToHistory,
    exportPDFFromHistory, exportTXTFromHistory, shareWhatsAppFromHistory,
    editExtFromHistory
  };
})();
