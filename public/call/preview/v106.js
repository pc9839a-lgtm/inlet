(() => {
  const cleanExample = value => String(value || '')
    .replace(/페이지로\s+(?!콜링크)[가-힣]{2,4}(?=입니다|$|\n)/g, '페이지로');

  Object.values(messages).forEach(item => { item.text = cleanExample(item.text); });
  situationTemplates.forEach(item => {
    item.answered = cleanExample(item.answered);
    item.missed = cleanExample(item.missed);
    item.outgoing = cleanExample(item.outgoing);
  });

  let messageStartMode = 'choice';
  let messagePreviewOpen = false;
  const previousMoreHtml = moreHtml;
  moreHtml = () => previousMoreHtml().replace('<div class="avatar">김</div>', '<div class="avatar">P</div>');

  messagesHtml = function () {
    if (messageStartMode === 'choice') {
      return `<div class="message-start">
        <h2>메시지를 어떻게<br>만들까요?</h2>
        <p class="start-lead">준비된 장문 템플릿을 고르거나 처음부터 직접 작성할 수 있습니다.</p>
        <div class="start-options">
          <button class="start-card primary-choice" id="startTemplate">
            <span class="start-icon">▤</span>
            <strong>템플릿으로 시작하기</strong>
            <small>신규 문의, 견적, 예약 등 상황에 맞는 문구를 고릅니다.</small>
          </button>
          <button class="start-card" id="startFree">
            <span class="start-icon">✎</span>
            <strong>자유롭게 쓰기</strong>
            <small>받은 전화, 부재중·거절, 내가 건 전화 문구를 직접 작성합니다.</small>
          </button>
        </div>
      </div>`;
    }

    const d = messages[messageTab];
    return `<button class="start-back" id="changeMessageStart">‹ 작성 방식 다시 선택</button>
      <div class="tabs">
        <button class="tab ${messageTab === 'answered' ? 'active' : ''}" data-message="answered">받은 전화</button>
        <button class="tab ${messageTab === 'missed' ? 'active' : ''}" data-message="missed">부재중·거절</button>
        <button class="tab ${messageTab === 'outgoing' ? 'active' : ''}" data-message="outgoing">내가 건 전화</button>
      </div>
      <div class="editor-title">${d.title}</div>
      <div class="card editor">
        <div class="switch-row"><span>${d.switchText}</span><div class="small-toggle"></div></div>
        <div class="field"><label>문자 내용</label><textarea class="input" id="messageText">${d.text}</textarea></div>
        <div class="field"><label>연결할 페이지 주소</label><input class="input" value="https://pagero.kr/demo"></div>
        <button class="message-preview-toggle" id="toggleMessagePreview"><span>${d.title} 미리보기</span><span id="messagePreviewArrow">${messagePreviewOpen ? '▴' : '▾'}</span></button>
        <div class="card preview message-preview-panel ${messagePreviewOpen ? 'open' : ''}" id="messagePreviewPanel"><span id="messagePreview">${d.text}</span>\n\nhttps://pagero.kr/demo</div>
        <button class="primary save" id="saveMessage">현재 메시지 저장</button>
      </div>`;
  };

  bindRoot = function () {
    $$('[data-go]').forEach(button => button.onclick = () => setTab(button.dataset.go));
    $$('[data-open]').forEach(button => button.onclick = () => openDetail(button.dataset.open));
    $$('[data-message]').forEach(button => button.onclick = () => {
      messageTab = button.dataset.message;
      messagePreviewOpen = false;
      setTab('messages');
    });
    if ($('#startTemplate')) $('#startTemplate').onclick = openSituationList;
    if ($('#startFree')) $('#startFree').onclick = () => {
      messageStartMode = 'editor';
      messagePreviewOpen = false;
      setTab('messages');
    };
    if ($('#changeMessageStart')) $('#changeMessageStart').onclick = () => {
      messageStartMode = 'choice';
      messagePreviewOpen = false;
      setTab('messages');
    };
    if ($('#messageText')) $('#messageText').oninput = event => {
      $('#messagePreview').textContent = event.target.value;
    };
    if ($('#toggleMessagePreview')) $('#toggleMessagePreview').onclick = () => {
      messagePreviewOpen = !messagePreviewOpen;
      $('#messagePreviewPanel').classList.toggle('open', messagePreviewOpen);
      $('#messagePreviewArrow').textContent = messagePreviewOpen ? '▴' : '▾';
    };
    if ($('#saveMessage')) $('#saveMessage').onclick = () => toast('현재 메시지를 저장했습니다.');
  };

  templatePreviewBlock = function (key, label, text) {
    return `<div class="template-item">
      <div class="template-head">
        <label class="template-check"><input type="checkbox" id="check-${key}" checked>${label}</label>
        <button class="preview-toggle" data-template-preview="${key}">미리보기</button>
      </div>
      <div class="template-preview" id="template-preview-${key}">${text}</div>
    </div>`;
  };

  openSituationPreview = function (index) {
    const selectedTemplate = situationTemplates[index];
    $('#sheetTitle').textContent = selectedTemplate.title;
    $('#sheetBody').innerHTML = `<button class="back-link" id="backSituations">‹ 상황 다시 선택</button>
      <p class="hint" style="margin:0 0 6px">${selectedTemplate.desc}</p>
      <p class="hint" style="margin:0 0 10px">문구는 미리보기를 눌러 하나씩 확인하세요.</p>
      ${templatePreviewBlock('answered', '받은 전화 후 문구 적용', selectedTemplate.answered)}
      ${templatePreviewBlock('missed', '부재중·거절 문구 적용', selectedTemplate.missed)}
      ${templatePreviewBlock('outgoing', '내가 건 전화 후 문구 적용', selectedTemplate.outgoing)}
      <p class="hint">적용 전 현재 문구는 저장된 템플릿 보관함에 자동 백업됩니다.</p>`;
    $('#sheetActions').innerHTML = '<button class="primary" id="applyTemplates">선택한 문구 적용</button>';
    $('#backSituations').onclick = openSituationList;

    $$('[data-template-preview]').forEach(button => {
      button.onclick = () => {
        const key = button.dataset.templatePreview;
        const target = $(`#template-preview-${key}`);
        const shouldOpen = !target.classList.contains('open');
        $$('.template-preview').forEach(view => view.classList.remove('open'));
        $$('[data-template-preview]').forEach(view => view.textContent = '미리보기');
        if (shouldOpen) {
          target.classList.add('open');
          button.textContent = '닫기';
        }
      };
    });

    $('#applyTemplates').onclick = () => {
      const selected = ['answered', 'missed', 'outgoing'].filter(key => $(`#check-${key}`).checked);
      if (!selected.length) {
        toast('적용할 문구를 하나 이상 선택해주세요.');
        return;
      }
      selected.forEach(key => { messages[key].text = selectedTemplate[key]; });
      messageStartMode = 'editor';
      messagePreviewOpen = false;
      closeModal();
      setTab('messages');
      toast(`${selectedTemplate.title} 문구를 적용했습니다.`);
    };
  };

  const previewContacts = [
    {name:'김민수', phone:'010-1234-5678'},
    {name:'박지현', phone:'010-8821-3490'},
    {name:'이서준', phone:'010-4402-1187'}
  ];

  function openContactPreview() {
    openModal('연락처에서 선택', previewContacts.map((contact, index) => `
      <button class="contact-row" data-contact-index="${index}">
        <span class="contact-avatar">${contact.name.slice(0,1)}</span>
        <span class="contact-info"><strong>${contact.name}</strong><small>${contact.phone}</small></span>
        <span class="chev">›</span>
      </button>`).join(''), '');
    $$('[data-contact-index]').forEach(button => {
      button.onclick = () => {
        const contact = previewContacts[Number(button.dataset.contactIndex)];
        closeModal();
        renderCustomerAdd(contact);
        toast('연락처에서 선택한 예시입니다.');
      };
    });
  }

  renderCustomers = function () {
    $('#detailTitle').textContent = '고객';
    $('#detailAction').textContent = '';
    $('#detailAction').onclick = null;
    $('#detailBottom').innerHTML = '';
    const visible = customers.filter(c => customerFilter === 'all'
      || (customerFilter === 'send' && c.status === '발송 가능')
      || (customerFilter === 'block' && c.status === '수신거부'));

    const listHtml = visible.length ? `<div class="card list">${visible.map(c => `
      <button class="row customer">
        <div class="grow"><div class="customer-name">${c.name}</div><div class="phone-no">${c.phone}</div><div class="customer-note">${c.memo}</div></div>
        <span class="badge">${c.status}</span><span class="chev">›</span>
      </button>`).join('')}</div>` : `<div class="card customer-empty"><strong>등록된 고객이 없습니다</strong><p>연락처에서 선택하거나 직접 입력해 첫 고객을 추가하세요.</p><button class="primary" id="emptyPickContact" style="width:100%">연락처에서 고객 선택</button><button class="secondary" id="emptyDirectAdd" style="width:100%;margin-top:10px">직접 입력해서 추가</button></div>`;

    $('#detailBody').innerHTML = `<div class="customer-actions">
      <button class="contact-choice" id="pickContact">연락처에서 선택</button>
      <button class="direct-choice" id="directAdd">직접 추가</button>
    </div>
    <input class="input search" placeholder="이름 또는 전화번호 검색">
    <div class="filters"><button class="filter ${customerFilter === 'all' ? 'active' : ''}" data-filter="all">전체</button><button class="filter ${customerFilter === 'send' ? 'active' : ''}" data-filter="send">발송 가능</button><button class="filter ${customerFilter === 'block' ? 'active' : ''}" data-filter="block">수신거부</button></div>
    <div class="menu-label">전체 고객 ${visible.length}명</div>${listHtml}`;

    $('#pickContact').onclick = openContactPreview;
    $('#directAdd').onclick = () => renderCustomerAdd();
    if ($('#emptyPickContact')) $('#emptyPickContact').onclick = openContactPreview;
    if ($('#emptyDirectAdd')) $('#emptyDirectAdd').onclick = () => renderCustomerAdd();
    $$('[data-filter]').forEach(button => button.onclick = () => {
      customerFilter = button.dataset.filter;
      renderCustomers();
    });
  };

  renderCustomerAdd = function (prefill = {}) {
    $('#detailTitle').textContent = '고객 추가';
    $('#detailAction').textContent = '';
    $('#detailBody').innerHTML = `<button class="editor-contact-button" id="pickContactInside">연락처에서 선택해서 입력</button>
      <div class="field" style="margin-top:0"><label>고객명</label><input class="input" id="newName" value="${prefill.name || ''}" placeholder="이름 입력"></div>
      <div class="field"><label>전화번호</label><input class="input" id="newPhone" value="${prefill.phone || ''}" placeholder="010-0000-0000"></div>
      <div class="field"><label>고객 그룹</label><select class="input"><option>신규 문의</option><option>기존 고객</option><option>VIP</option></select></div>
      <div class="field"><label>메모</label><textarea class="input" style="height:110px"></textarea></div>`;
    $('#detailBottom').innerHTML = `<div class="bottom-action"><button class="secondary" id="cancelAdd">취소</button><button class="primary" id="saveAdd">저장</button></div>`;
    $('#pickContactInside').onclick = openContactPreview;
    $('#cancelAdd').onclick = renderCustomers;
    $('#saveAdd').onclick = () => {
      customers.unshift({name:$('#newName').value || '새 고객', phone:$('#newPhone').value || '010-0000-0000', memo:'신규 문의', status:'발송 가능'});
      toast('고객을 추가했습니다.');
      renderCustomers();
    };
  };
})();