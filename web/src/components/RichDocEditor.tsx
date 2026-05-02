import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Mark, mergeAttributes } from '@tiptap/core';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Maximize2, X, Type,
} from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';

const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: el => el.getAttribute('data-fs'),
        renderHTML: attrs => {
          if (!attrs.size) return {};
          return { 'data-fs': attrs.size, style: `font-size: ${attrs.size}` };
        },
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-fs]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
  addCommands(): any {
    return {
      setFontSize: (size: string) => ({ commands }: any) => commands.setMark(this.name, { size }),
      unsetFontSize: () => ({ commands }: any) => commands.unsetMark(this.name),
    };
  },
});

const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '16px' },
  { label: 'Large', value: '20px' },
  { label: 'XLarge', value: '24px' },
  { label: 'Huge', value: '32px' },
];

interface Props {
  content: string;
  title: string;
  onContentSave: (html: string) => void;
  onTitleSave: (title: string) => void;
  isSaving?: boolean;
}

const editorCss = `
  .ProseMirror { outline: none; }
  .ProseMirror p { margin: 0.25rem 0; line-height: 1.7; }
  .ProseMirror h1 { font-size: 2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
  .ProseMirror h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
  .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.35rem; }
  .ProseMirror strong { font-weight: 700; }
  .ProseMirror em { font-style: italic; }
  .ProseMirror u { text-decoration: underline; }
  .ProseMirror s { text-decoration: line-through; }
  .ProseMirror mark { background-color: #fef08a; color: inherit; border-radius: 2px; padding: 0 2px; }
  .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
  .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
  .ProseMirror li { margin: 0.15rem 0; }
  .ProseMirror blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; margin: 0.5rem 0; }
  .ProseMirror code { background: #f1f5f9; border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.875em; }
  .ProseMirror pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 0.5rem 0; }
  .ProseMirror pre code { background: none; padding: 0; }

  /* ── Task list ───────────────────────────────────────────── */
  .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; margin: 0.25rem 0; }

  /* The <li> is a flex row: [label | content-div] */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] {
    display: flex;
    align-items: flex-start;
    margin: 0.2rem 0;
  }

  /* The <label> wraps the checkbox — shrink to fit, no gap */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] > label {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-top: 0.28rem;   /* vertically centre with first line of text */
    padding-right: 0.5rem;  /* space between checkbox and text */
    cursor: pointer;
    user-select: none;
    line-height: 1;
  }

  /* Hide the decorative <span> TipTap adds — the real <input> is visible */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] > label > span {
    display: none;
  }

  /* The actual checkbox */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] > label > input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: #4f46e5;
    flex-shrink: 0;
    display: block;
  }

  /* The contentDOM <div> — editable text area */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] > div {
    flex: 1;
    min-width: 0;
  }

  /* Zero out paragraph margins inside task items so height stays tight */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"] > div > p {
    margin: 0;
    line-height: 1.7;
  }

  /* Checked state: strikethrough + dim */
  .ProseMirror ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] > div {
    text-decoration: line-through;
    opacity: 0.5;
  }
`;

const defaultEditorActiveState = {
  bold: false, italic: false, underline: false, strike: false,
  highlight: false, h1: false, h2: false, h3: false,
  alignLeft: false, alignCenter: false, alignRight: false,
  bulletList: false, orderedList: false, taskList: false,
  canUndo: false, canRedo: false,
  color: '#1e293b' as string,
  headingValue: 'p' as string,
};

export function RichDocEditor({ content, title, onContentSave, onTitleSave, isSaving }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const lastSentContent = useRef(content);

  useEffect(() => { setLocalTitle(title); }, [title]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    content,
    onBlur: ({ editor: e }) => {
      const html = e.getHTML();
      lastSentContent.current = html;
      onContentSave(html);
    },
  });

  // useEditorState subscribes to every transaction and re-renders only when
  // the selected values change. This is the TipTap v3 way to get reactive
  // isActive() / can() checks — plain editor.isActive() in render is stale.
  const st = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return defaultEditorActiveState;
      const e = ctx.editor;
      const h1 = e.isActive('heading', { level: 1 });
      const h2 = e.isActive('heading', { level: 2 });
      const h3 = e.isActive('heading', { level: 3 });
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        highlight: e.isActive('highlight'),
        h1, h2, h3,
        alignLeft: e.isActive({ textAlign: 'left' }),
        alignCenter: e.isActive({ textAlign: 'center' }),
        alignRight: e.isActive({ textAlign: 'right' }),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        color: (e.getAttributes('textStyle').color as string) || '#1e293b',
        headingValue: h1 ? 'h1' : h2 ? 'h2' : h3 ? 'h3' : 'p',
      };
    },
  }) ?? defaultEditorActiveState;

  // Sync content only when it comes from an external source (not our own save)
  useEffect(() => {
    if (!editor) return;
    if (content !== lastSentContent.current) {
      editor.commands.setContent(content);
      lastSentContent.current = content;
    }
  }, [content, editor]);

  if (!editor) return null;

  // Using onMouseDown + preventDefault so clicking a toolbar button does NOT
  // blur the editor — the selection stays intact and the command runs on it.
  const Btn = ({
    onClick,
    active,
    title: tip,
    children,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    title?: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      title={tip}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );

  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      <Select
        value={st.headingValue}
        onValueChange={(v) => {
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: parseInt(v[1]) as 1 | 2 | 3 }).run();
        }}
      >
        <SelectTrigger className="h-7 w-[100px] text-xs border-slate-200 bg-white" onMouseDown={(e) => e.preventDefault()}>
          <Type className="mr-1 h-3 w-3" /><SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Normal</SelectItem>
          <SelectItem value="h1">Heading 1</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value="16px"
        onValueChange={(v) => {
          if (v === '16px') (editor.chain().focus() as any).unsetFontSize().run();
          else (editor.chain().focus() as any).setFontSize(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-[80px] text-xs border-slate-200 bg-white" onMouseDown={(e) => e.preventDefault()}>
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={st.bold} title="Bold"><Bold className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={st.italic} title="Italic"><Italic className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={st.underline} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={st.strike} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={st.highlight} title="Highlight"><Highlighter className="h-3.5 w-3.5" /></Btn>

      {/* Color picker — no onMouseDown needed, native input */}
      <label title="Text color" className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-slate-100">
        <span className="relative">
          <span className="text-xs font-bold leading-none" style={{ color: st.color }}>A</span>
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            defaultValue="#1e293b"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </span>
      </label>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={st.alignLeft} title="Align left"><AlignLeft className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={st.alignCenter} title="Align center"><AlignCenter className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={st.alignRight} title="Align right"><AlignRight className="h-3.5 w-3.5" /></Btn>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={st.bulletList} title="Bullet list"><List className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={st.orderedList} title="Ordered list"><ListOrdered className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={st.taskList} title="Checklist"><ListChecks className="h-3.5 w-3.5" /></Btn>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!st.canUndo} title="Undo"><Undo2 className="h-3.5 w-3.5" /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!st.canRedo} title="Redo"><Redo2 className="h-3.5 w-3.5" /></Btn>

      <div className="ml-auto flex items-center gap-2">
        {isSaving && <span className="text-[10px] text-slate-400">Saving…</span>}
        <button
          type="button"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
          onMouseDown={(e) => { e.preventDefault(); setIsFullscreen(f => !f); }}
        >
          {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const EditorBody = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <EditorContent
      editor={editor}
      className={cn(
        'overflow-y-auto text-slate-900',
        fullscreen ? 'min-h-[60vh] p-2' : 'min-h-[280px] max-h-[480px] px-3 py-3 text-sm',
      )}
    />
  );

  return (
    <>
      <style>{editorCss}</style>

      {!isFullscreen && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <Toolbar />
          <EditorBody />
        </div>
      )}

      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-100 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">B</span>
              </div>
              <input
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={() => { if (localTitle !== title) onTitleSave(localTitle); }}
                className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 min-w-[200px]"
                placeholder="Untitled"
              />
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <span className="text-xs text-slate-400">Saving…</span>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-slate-600"
                onMouseDown={(e) => { e.preventDefault(); onContentSave(editor.getHTML()); setIsFullscreen(false); }}
              >
                <X className="h-4 w-4" /> Exit
              </Button>
            </div>
          </div>

          <div className="sticky top-[57px] z-10 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-4xl mx-auto"><Toolbar /></div>
          </div>

          <div className="flex-1 py-12 px-4">
            <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-sm min-h-[calc(100vh-220px)]" style={{ padding: '72px 96px' }}>
              <EditorBody fullscreen />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RichDocEditor;
