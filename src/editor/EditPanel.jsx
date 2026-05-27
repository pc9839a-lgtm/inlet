import React from 'react';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { META, SINGLETON_BLOCK_TYPES } from '../config/blockMeta.jsx';

const ADD_GROUPS = [
  ['content', '콘텐츠'],
  ['conversion', '문의/전환'],
  ['info', '정보/효과'],
  ['layout', '구성'],
];

export default function EditPanel({ page, openId, setOpenId, addOpen, setAddOpen, dragId, setDragId, updateTheme, toggleVisible, addBlock, removeBlock, duplicateBlock, reorderToIndex, renderTopNavEditor, renderBottomBarEditor, renderFooterEditor, renderBlockEditor }) {
  const topNavBlock = page.blocks.find((b)=>b.type==='topnav');
  const hideTopNavControl = page.slug === 'our-wedding-day' || page.title === '모바일 청첩장' || topNavBlock?.s?.omitEditor;
  const bottomBlock = page.blocks.find((b)=>b.type==='bottombar');
  const footerBlock = page.blocks.find((b)=>b.type==='footer');
  const normalBlocks = page.blocks.filter((b)=>!['topnav','bottombar','footer'].includes(b.type));

  return (
    <div className="edit-layout">
      <section className="card edit-animation-card">
        <div className="edit-animation-head">
          <div>
            <b>애니메이션</b>
            
          </div>
          <label className="switch-clean">
            <input type="checkbox" checked={!!page.theme.animOn} onChange={(e)=>updateTheme({animOn:e.target.checked})} />
            <i></i>
          </label>
        </div>
        {page.theme.animOn && (
          <div className="edit-animation-options">
            {[['fade','서서히'],['up','아래에서'],['scale','확대']].map(([key,label]) => (
              <button key={key} type="button" className={(page.theme.animType || 'fade') === key ? 'active' : ''} onClick={()=>updateTheme({animType:key})}>{label}</button>
            ))}
          </div>
        )}
      </section>

      {topNavBlock && !hideTopNavControl && (
        <section className={`card topnav-fixed-card ${openId===topNavBlock.id?'open':''}`}>
          <button className="topnav-fixed-head" type="button" onClick={()=>setOpenId(openId===topNavBlock.id?'':topNavBlock.id)}>
            <div>
              <strong>상단 메뉴</strong>
              <em>히어로 아래 표시</em>
            </div>
            <label className="switch-clean" onClick={(e)=>e.stopPropagation()}>
              <input type="checkbox" checked={!!topNavBlock.visible} onChange={()=>toggleVisible(topNavBlock.id)} />
              <i></i>
            </label>
            <b>{openId===topNavBlock.id?'⌃':'⌄'}</b>
          </button>
          {openId===topNavBlock.id && (
            <div className="topnav-fixed-editor">
              {renderTopNavEditor(topNavBlock)}
            </div>
          )}
        </section>
      )}

      {bottomBlock && (
        <section className={`card bottom-cta-card ${openId===bottomBlock.id?'open':''}`}>
          <button className="bottom-cta-head" type="button" onClick={()=>setOpenId(openId===bottomBlock.id?'':bottomBlock.id)}>
            <div>
              <strong>하단 고정 버튼</strong>
              <em>화면 하단 표시</em>
            </div>
            <label className="switch-clean" onClick={(e)=>e.stopPropagation()}>
              <input type="checkbox" checked={!!bottomBlock.visible} onChange={()=>toggleVisible(bottomBlock.id)} />
              <i></i>
            </label>
            <b>{openId===bottomBlock.id?'⌃':'⌄'}</b>
          </button>
          {openId===bottomBlock.id && (
            <div className="bottom-cta-editor">
              {renderBottomBarEditor(bottomBlock)}
            </div>
          )}
        </section>
      )}

      {footerBlock && (
        <section className={`card footer-fixed-card ${openId===footerBlock.id?'open':''}`}>
          <button className="footer-fixed-head" type="button" onClick={()=>setOpenId(openId===footerBlock.id?'':footerBlock.id)}>
            <div>
              <strong>푸터</strong>
              <em>페이지 끝 표시</em>
            </div>
            <label className="switch-clean" onClick={(e)=>e.stopPropagation()}>
              <input type="checkbox" checked={!!footerBlock.visible} onChange={()=>toggleVisible(footerBlock.id)} />
              <i></i>
            </label>
            <b>{openId===footerBlock.id?'⌃':'⌄'}</b>
          </button>
          {openId===footerBlock.id && (
            <div className="footer-fixed-editor">
              {renderFooterEditor(footerBlock)}
            </div>
          )}
        </section>
      )}

      <section className="card block-card screen-order-card">
        <div className="section-title screen-order-title">
          <h2>화면 순서</h2>
          <p>보이는 순서대로 위에서 아래로 배치됩니다.</p>
        </div>
        <div className="block-list screen-order-list">
          {normalBlocks.map((block, index) => {
            const meta = META[block.type] || META.text;
            const Icon = meta.icon;
            const open = openId === block.id;
            const anchor = block.s?.anchorId || block.type;
            const canMoveUp = index > 0;
            const canMoveDown = index < normalBlocks.length - 1;
            const moveUp = (e) => {
              e.stopPropagation();
              if (canMoveUp) reorderToIndex(block.id, index - 1);
            };
            const moveDown = (e) => {
              e.stopPropagation();
              if (canMoveDown) reorderToIndex(block.id, index + 2);
            };

            const dragStart = (e) => {
              e.stopPropagation();
              setDragId(block.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', block.id);
            };

            const activateDrop = (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const from = e.dataTransfer.getData('text/plain') || dragId;
              if (from && from !== block.id) e.currentTarget.classList.add('active');
            };

            const clearDrop = (e) => {
              e.currentTarget.classList.remove('active');
            };

            const dropAt = (e, targetIndex) => {
              e.preventDefault();
              e.currentTarget.classList.remove('active');
              const from = e.dataTransfer.getData('text/plain') || dragId;
              reorderToIndex(from, targetIndex);
              setDragId('');
            };

            return (
              <React.Fragment key={block.id}>
                <div
                  className="screen-drop-zone"
                  onDragOver={activateDrop}
                  onDragEnter={activateDrop}
                  onDragLeave={clearDrop}
                  onDrop={(e)=>dropAt(e, index)}
                >
                  <span></span>
                </div>

                <div
                  id={`editor-block-${block.id}`}
                  className={`block-item screen-order-item ${open ? 'open' : ''} ${!block.visible ? 'muted' : ''} ${dragId === block.id ? 'dragging' : ''}`}
                  data-order={index + 1}
                >
                  <div className="block-head screen-order-head">
                    <div
                      className="drag screen-drag-handle"
                      draggable
                      onDragStart={dragStart}
                      onDragEnd={() => setDragId('')}
                      role="button"
                      tabIndex={0}
                      title="잡고 끌어서 순서 변경"
                    >
                      <GripVertical size={18}/>
                    </div>

                    <button type="button" className="screen-title-wrap" onClick={() => setOpenId(open ? '' : block.id)}>
                      <span className="screen-order-number">{index + 1}</span>
                      <Icon size={17}/>
                      <strong>{meta.label}</strong>
                      <em className="anchor-head-code">#{anchor}</em>
                    </button>

                    <button type="button" aria-label={block.visible ? '활성' : '비활성'} className={`on screen-on-toggle ${block.visible ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleVisible(block.id); }}>
                      <span></span>
                    </button>

                    <span className="screen-move-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={moveUp} disabled={!canMoveUp} title="위로 이동" aria-label={`${meta.label} 위로 이동`}>↑</button>
                      <button type="button" onClick={moveDown} disabled={!canMoveDown} title="아래로 이동" aria-label={`${meta.label} 아래로 이동`}>↓</button>
                    </span>

                    <span className="head-actions" onClick={(e) => e.stopPropagation()}>
                      {!SINGLETON_BLOCK_TYPES.includes(block.type) && <button type="button" onClick={() => duplicateBlock(block.id)} title="복제"><Copy size={15}/></button>}
                      <button type="button" onClick={() => removeBlock(block.id)} className="danger" title="삭제"><Trash2 size={15}/></button>
                    </span>

                    <button type="button" className="screen-open-toggle" onClick={() => setOpenId(open ? '' : block.id)}>{open ? '⌃' : '⌄'}</button>
                  </div>
                  {open && <div className="block-editor">{renderBlockEditor(block)}</div>}
                </div>

                {index === normalBlocks.length - 1 && (
                  <div
                    className="screen-drop-zone last"
                    onDragOver={activateDrop}
                    onDragEnter={activateDrop}
                    onDragLeave={clearDrop}
                    onDrop={(e)=>dropAt(e, normalBlocks.length)}
                  >
                    <span></span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      <section className={`add-dock fixed-add-dock ${addOpen ? 'open' : ''} ${openId ? 'editing' : ''}`}>
        <button className="add-toggle" onClick={() => setAddOpen(!addOpen)}>
          <Plus size={18}/><strong>추가</strong><span>{addOpen ? '닫기' : '열기'}</span>
        </button>
        {addOpen && (
          <div className="add-panel">
            <div className="widget-group-grid">
              {ADD_GROUPS.map(([category, label]) => {
                const items = Object.entries(META).filter(([type, meta]) => !SINGLETON_BLOCK_TYPES.includes(type) && (meta.category || 'content') === category);
                if (!items.length) return null;
                return (
                  <div className="widget-group" key={category}>
                    <b>{label}</b>
                    <div>
                      {items.map(([type, meta]) => {
                        const Icon = meta.icon;
                        return <button key={type} type="button" onClick={() => addBlock(type)}><Icon size={16}/><strong>{meta.label}</strong></button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

