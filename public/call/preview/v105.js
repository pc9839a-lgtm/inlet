(() => {
  const removePersonalName = value => String(value || '').replaceAll('페이지로 김도윤', '페이지로');
  Object.values(messages).forEach(item => { item.text = removePersonalName(item.text); });
  situationTemplates.forEach(item => {
    item.answered = removePersonalName(item.answered);
    item.missed = removePersonalName(item.missed);
    item.outgoing = removePersonalName(item.outgoing);
  });

  let messageStartMode = 'choice';
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
            <small>신규 문의, 견적, 예약 등 상황에 맞는 문구를 골라 바로 편집합니다.</small>
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
        <div class="card preview"><b>${d.title} 미리보기</b>\n\n<span id="messagePreview">${d.text}</span>\n\nhttps://pagero.kr/demo</div>
        <button class="primary save" id="saveMessage">현재 메시지 저장</button>
      </div>
      <p class="hint">템플릿을 다시 고르려면 위의 ‘작성 방식 다시 선택’을 누르세요.</p>`;
  };

  bindRoot = function () {
    $$('[data-go]').forEach(button => button.onclick = () => setTab(button.dataset.go));
    $$('[data-open]').forEach(button => button.onclick = () => openDetail(button.dataset.open));
    $$('[data-message]').forEach(button => button.onclick = () => {
      messageTab = button.dataset.message;
      setTab('messages');
    });
    if ($('#startTemplate')) $('#startTemplate').onclick = openSituationList;
    if ($('#startFree')) $('#startFree').onclick = () => {
      messageStartMode = 'editor';
      setTab('messages');
    };
    if ($('#changeMessageStart')) $('#changeMessageStart').onclick = () => {
      messageStartMode = 'choice';
      setTab('messages');
    };
    if ($('#messageText')) $('#messageText').oninput = event => {
      $('#messagePreview').textContent = event.target.value;
    };
    if ($('#saveMessage')) $('#saveMessage').onclick = () => toast('현재 메시지를 저장했습니다.');
  };

  openSituationPreview = function (index) {
    const selectedTemplate = situationTemplates[index];
    $('#sheetTitle').textContent = selectedTemplate.title;
    $('#sheetBody').innerHTML = `<button class="back-link" id="backSituations">‹ 상황 다시 선택</button>
      <p class="hint" style="margin:0 0 12px">${selectedTemplate.desc}</p>
      ${templatePreviewBlock('answered', '받은 전화 후 문구 적용', selectedTemplate.answered)}
      ${templatePreviewBlock('missed', '부재중·거절 문구 적용', selectedTemplate.missed)}
      ${templatePreviewBlock('outgoing', '내가 건 전화 후 문구 적용', selectedTemplate.outgoing)}
      <p class="hint">적용 전 현재 문구는 저장된 템플릿 보관함에 자동 백업됩니다.</p>`;
    $('#sheetActions').innerHTML = '<button class="primary" id="applyTemplates">선택한 문구 적용</button>';
    $('#backSituations').onclick = openSituationList;
    $('#applyTemplates').onclick = () => {
      const selected = ['answered', 'missed', 'outgoing'].filter(key => $(`#check-${key}`).checked);
      if (!selected.length) {
        toast('적용할 문구를 하나 이상 선택해주세요.');
        return;
      }
      selected.forEach(key => { messages[key].text = selectedTemplate[key]; });
      messageStartMode = 'editor';
      closeModal();
      setTab('messages');
      toast(`${selectedTemplate.title} 문구를 적용했습니다.`);
    };
  };
})();