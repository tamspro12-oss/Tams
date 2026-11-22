import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSafeUrl, renderSafeBlogContent, sanitizeHtmlString } from "@/lib/blogSanitizer";
import { uploadBlogImageAdmin } from "@/lib/blogs";

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  resetKey?: string;
  placeholder?: string;
}

const PROSE_CLASSES =
  "text-sm leading-relaxed text-foreground " +
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 " +
  "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 " +
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 " +
  "[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 " +
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1 " +
  "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-primary/5 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:my-3 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:font-medium " +
  "[&_img]:max-w-full [&_img]:h-auto [&_img]:my-3 [&_img]:border " +
  "[&_hr]:my-4 [&_hr]:border-border";

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  resetKey = "default",
  placeholder = "Write your article content here...",
}) => {
  const [viewMode, setViewMode] = useState<"visual" | "html" | "preview">("visual");
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageBar, setShowImageBar] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const lastEmittedRef = useRef<string>("");
  const lastResetKeyRef = useRef<string>("");

  // Sync incoming value into contentEditable when switching posts or returning to Visual tab
  useEffect(() => {
    if (viewMode !== "visual") return;
    const el = editorRef.current;
    if (!el) return;

    const resetChanged = lastResetKeyRef.current !== resetKey;
    const externalUpdate = value !== lastEmittedRef.current;

    if (resetChanged || externalUpdate) {
      const normalizedHtml = renderSafeBlogContent(value || "");
      el.innerHTML = normalizedHtml;
      lastEmittedRef.current = normalizedHtml;
      lastResetKeyRef.current = resetKey;
    }
  }, [value, resetKey, viewMode]);

  const emitFromEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    const cleaned = sanitizeHtmlString(el.innerHTML);
    lastEmittedRef.current = cleaned;
    onChange(cleaned);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    const el = editorRef.current;
    if (!selection || selection.rangeCount === 0 || !el) return;
    const range = selection.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = savedSelectionRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const runExec = (command: string, commandValue?: string) => {
    if (viewMode !== "visual") {
      setViewMode("visual");
      window.setTimeout(() => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        emitFromEditor();
      }, 0);
      return;
    }

    restoreSelection();
    document.execCommand(command, false, commandValue);
    saveSelection();
    emitFromEditor();
  };

  const handleOpenLinkBar = () => {
    saveSelection();
    setShowImageBar(false);
    setShowLinkBar((prev) => !prev);
  };

  const handleApplyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      toast.error("Please enter a link URL.");
      return;
    }
    if (!isSafeUrl(trimmed, { allowMailto: true })) {
      toast.error("Please enter a valid http://, https://, /path, or mailto: URL.");
      return;
    }
    restoreSelection();
    const selection = window.getSelection();
    if (selection && selection.isCollapsed) {
      const linkHtml = `<a href="${trimmed}">${trimmed}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    } else {
      document.execCommand("createLink", false, trimmed);
    }
    emitFromEditor();
    setLinkUrl("");
    setShowLinkBar(false);
  };

  const handleRemoveLink = () => {
    restoreSelection();
    document.execCommand("unlink");
    emitFromEditor();
    setShowLinkBar(false);
  };

  const handleOpenImageBar = () => {
    saveSelection();
    setShowLinkBar(false);
    setShowImageBar((prev) => !prev);
  };

  const insertSafeImageAtCursor = (url: string, alt: string) => {
    restoreSelection();
    const safeAlt = (alt || "Blog image").replace(/"/g, "&quot;");
    const html = `<img src="${url}" alt="${safeAlt}" />`;
    document.execCommand("insertHTML", false, html);
    emitFromEditor();
  };

  const handleInsertImageUrl = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed || !isSafeUrl(trimmed, { allowMailto: false })) {
      toast.error("Please enter a valid http:// or https:// image URL.");
      return;
    }
    insertSafeImageAtCursor(trimmed, imageAlt.trim());
    setImageUrl("");
    setImageAlt("");
    setShowImageBar(false);
  };

  const handleUploadInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingInlineImage(true);
    try {
      const { url, error } = await uploadBlogImageAdmin(file);
      if (error || !url) {
        toast.error(error || "Failed to upload inline image.");
        return;
      }
      insertSafeImageAtCursor(url, imageAlt.trim() || file.name.replace(/\.[^.]+$/, ""));
      setImageUrl("");
      setImageAlt("");
      setShowImageBar(false);
      toast.success("Image inserted into article");
    } finally {
      setUploadingInlineImage(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      const cleaned = sanitizeHtmlString(html);
      document.execCommand("insertHTML", false, cleaned);
      emitFromEditor();
    }
  };

  const handleEditorModeChange = (nextMode: string) => {
    if (nextMode === "visual" || nextMode === "html" || nextMode === "preview") {
      if (viewMode === "visual") {
        emitFromEditor();
      }
      setViewMode(nextMode);
    }
  };

  const previewHtml = renderSafeBlogContent(value || "");

  return (
    <div data-nav-skip="true" className="border border-border bg-background">
      {/* Top Bar: Formatting Toolbar + Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-muted/40">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Paragraph"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("formatBlock", "P")}
          >
            <Pilcrow className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Heading 2"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("formatBlock", "H2")}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Heading 3"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("formatBlock", "H3")}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </Button>

          <span className="h-4 w-px bg-border mx-1" aria-hidden="true" />

          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Bold"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("bold")}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Italic"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("italic")}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("underline")}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Strikethrough"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("strikeThrough")}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Button>

          <span className="h-4 w-px bg-border mx-1" aria-hidden="true" />

          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Bulleted list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("insertUnorderedList")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Numbered list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("insertOrderedList")}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Quote"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("formatBlock", "BLOCKQUOTE")}
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Horizontal divider"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("insertHorizontalRule")}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <span className="h-4 w-px bg-border mx-1" aria-hidden="true" />

          <Button
            type="button"
            data-compact-btn=""
            variant={showLinkBar ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            title="Insert link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenLinkBar}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant={showImageBar ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            title="Insert image"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenImageBar}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>

          <span className="h-4 w-px bg-border mx-1" aria-hidden="true" />

          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Undo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("undo")}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Redo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("redo")}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            title="Clear formatting"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExec("removeFormat")}
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Tabs value={viewMode} onValueChange={handleEditorModeChange}>
          <TabsList className="h-8">
            <TabsTrigger value="visual" className="text-xs px-2.5 h-6">
              Visual
            </TabsTrigger>
            <TabsTrigger value="html" className="text-xs px-2.5 h-6">
              HTML / Markdown
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs px-2.5 h-6">
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Inline Link Insertion Bar */}
      {showLinkBar && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 border-b bg-muted/20">
          <Input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://tamspro.online/pricing or /signup"
            className="h-8 text-xs flex-1 min-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyLink();
              }
            }}
          />
          <Button type="button" data-compact-btn="" size="sm" className="h-8 text-xs" onClick={handleApplyLink}>
            Apply Link
          </Button>
          <Button type="button" data-compact-btn="" variant="outline" size="sm" className="h-8 text-xs" onClick={handleRemoveLink}>
            Unlink
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setShowLinkBar(false)}
            aria-label="Close link toolbar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Inline Image Insertion Bar */}
      {showImageBar && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 border-b bg-muted/20">
          <input
            ref={inlineImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUploadInlineImage}
          />
          <Button
            type="button"
            data-compact-btn=""
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={uploadingInlineImage}
            onClick={() => inlineImageInputRef.current?.click()}
          >
            {uploadingInlineImage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span>Upload Image</span>
          </Button>
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Or paste image URL (https://...)"
            className="h-8 text-xs flex-1 min-w-[180px]"
          />
          <Input
            type="text"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            placeholder="Alt text"
            className="h-8 text-xs w-40"
          />
          <Button type="button" data-compact-btn="" size="sm" className="h-8 text-xs" onClick={handleInsertImageUrl}>
            Insert URL
          </Button>
          <Button
            type="button"
            data-compact-btn=""
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setShowImageBar(false)}
            aria-label="Close image toolbar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Editor Surface */}
      {viewMode === "visual" ? (
        <div className="relative">
          {!value && (
            <div className="pointer-events-none absolute top-3.5 left-4 text-sm text-muted-foreground/70">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emitFromEditor}
            onBlur={() => {
              saveSelection();
              emitFromEditor();
            }}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onPaste={handlePaste}
            className={`min-h-[320px] max-h-[560px] overflow-y-auto p-4 bg-white focus:outline-none ${PROSE_CLASSES}`}
          />
        </div>
      ) : viewMode === "html" ? (
        <Textarea
          value={value}
          onChange={(e) => {
            lastEmittedRef.current = e.target.value;
            onChange(e.target.value);
          }}
          placeholder="<p>Write clean HTML or Markdown...</p>"
          className="min-h-[320px] border-0 font-mono text-xs p-4 focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-[320px] max-h-[560px] overflow-y-auto p-4 bg-white">
          {previewHtml ? (
            <div className={PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

