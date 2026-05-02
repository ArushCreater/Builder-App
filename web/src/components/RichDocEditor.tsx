import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Mark, mergeAttributes } from '@tiptap/core';
import { useEffect, useState } from 'react';
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

export function RichDocEditor({ content, title, onContentSave, onTitleSave, isSaving }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

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
      onContentSave(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  const ToolbarButton = ({
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
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );

  const Toolbar = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn(
      'flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5',
      compact && 'rounded-t-xl'
    )}>
      {/* Heading / Paragraph */}
      <Select
        value={
          editor.isActive('heading', { level: 1 }) ? 'h1' :
          editor.isActive('heading', { level: 2 }) ? 'h2' :
          editor.isActive('heading', { level: 3 }) ? 'h3' :
          'p'
        }
        onValueChange={(v) => {
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: parseInt(v[1]) as 1|2|3 }).run();
        }}
      >
        <SelectTrigger className="h-7 w-[100px] text-xs border-slate-200 bg-white">
          <Type className="mr-1 h-3 w-3" /><SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Normal</SelectItem>
          <SelectItem value="h1">Heading 1</SelectItem>
          <SelectItem value="h2">Heading 2</SelectItem>
          <SelectItem value="h3">Heading 3</SelectItem>
        </SelectContent>
      </Select>

      {/* Font size */}
      <Select
        value="16px"
        onValueChange={(v) => {
          if (v === '16px') (editor.chain().focus() as any).unsetFontSize().run();
          else (editor.chain().focus() as any).setFontSize(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-[80px] text-xs border-slate-200 bg-white">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Bold / Italic / Underline / Strike */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Text color */}
      <label title="Text color" className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-slate-100">
        <span className="relative">
          <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || '#1e293b' }}>A</span>
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            defaultValue="#1e293b"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </span>
      </label>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">
        <ListChecks className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Undo/Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-2">
        {isSaving && <span className="text-[10px] text-slate-400">Saving…</span>}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setIsFullscreen(f => !f)}
        >
          {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  const editorStyles = `
    .tiptap-doc { outline: none; }
    .tiptap-doc p { margin: 0.25rem 0; line-height: 1.7; }
    .tiptap-doc h1 { font-size: 2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
    .tiptap-doc h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
    .tiptap-doc h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.35rem; }
    .tiptap-doc strong { font-weight: 700; }
    .tiptap-doc em { font-style: italic; }
    .tiptap-doc u { text-decoration: underline; }
    .tiptap-doc s { text-decoration: line-through; }
    .tiptap-doc mark { background-color: #fef08a; color: inherit; border-radius: 2px; padding: 0 2px; }
    .tiptap-doc ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
    .tiptap-doc ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
    .tiptap-doc li { margin: 0.15rem 0; }
    .tiptap-doc ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    .tiptap-doc ul[data-type="taskList"] li[data-type="taskItem"] { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.25rem 0; }
    .tiptap-doc ul[data-type="taskList"] li[data-type="taskItem"] label { display: flex; align-items: center; padding-top: 0.2rem; }
    .tiptap-doc ul[data-type="taskList"] li[data-type="taskItem"] input[type="checkbox"] { cursor: pointer; width: 15px; height: 15px; accent-color: #4f46e5; }
    .tiptap-doc ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] > div { text-decoration: line-through; color: #9ca3af; }
    .tiptap-doc ul[data-type="taskList"] li[data-type="taskItem"] > div { flex: 1; }
    .tiptap-doc blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; margin: 0.5rem 0; }
    .tiptap-doc code { background: #f1f5f9; border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.875em; }
    .tiptap-doc pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 0.5rem 0; }
    .tiptap-doc pre code { background: none; padding: 0; }
    .tiptap-doc p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; float: left; height: 0; }
  `;

  const EditorBody = ({ fullscreen = false }: { fullscreen?: boolean }) => (
    <EditorContent
      editor={editor}
      className={cn(
        'tiptap-doc overflow-y-auto text-slate-900',
        fullscreen
          ? 'min-h-[60vh] p-2'
          : 'min-h-[280px] max-h-[480px] px-3 py-3 text-sm'
      )}
    />
  );

  return (
    <>
      <style>{editorStyles}</style>

      {/* Inline editor (shown when not fullscreen) */}
      {!isFullscreen && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <Toolbar />
          <EditorBody />
        </div>
      )}

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-100 overflow-auto">
          {/* Top bar */}
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
                onClick={() => {
                  onContentSave(editor.getHTML());
                  setIsFullscreen(false);
                }}
              >
                <X className="h-4 w-4" /> Exit
              </Button>
            </div>
          </div>

          {/* Toolbar pinned below top bar */}
          <div className="sticky top-[57px] z-10 bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-4xl mx-auto">
              <Toolbar />
            </div>
          </div>

          {/* Page */}
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
