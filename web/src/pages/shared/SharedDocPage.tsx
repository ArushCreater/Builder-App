import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, ThumbsUp } from 'lucide-react';

interface SharedDoc {
  title: string;
  content: string;
  projectName: string;
  updatedAt: string;
  clientApprovedAt: string | null;
}

export function SharedDocPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [justApproved, setJustApproved] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared-doc', token],
    queryFn: async () => {
      const res = await fetch(`/api/shared/${token}`);
      if (!res.ok) throw new Error('Not found');
      return res.json() as Promise<SharedDoc>;
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/shared/${token}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      setJustApproved(true);
      queryClient.invalidateQueries({ queryKey: ['shared-doc', token] });
    },
  });

  const isApproved = !!(data?.clientApprovedAt || justApproved);
  const approvedAt = data?.clientApprovedAt;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3 shadow-lg">
        <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shadow-inner flex-shrink-0">
          <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-300 flex items-center justify-center text-slate-900 font-bold text-xs">
            B
          </div>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">BuilderOS</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
            powered by Baaz Homes
          </span>
        </div>
        {data?.projectName && (
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-300">
            <span className="hidden sm:inline text-slate-500">Project</span>
            <span className="font-medium text-white">{data.projectName}</span>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-slate-500 text-sm">Loading document…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                <span className="text-3xl">🔗</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">Link not found</h2>
              <p className="text-gray-500 text-sm max-w-xs">
                This link may have expired or the document has been removed.
              </p>
            </div>
          ) : data ? (
            <>
              {/* Approval banner / button */}
              {isApproved ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800">Document approved</p>
                    {approvedAt && (
                      <p className="text-sm text-emerald-600 mt-0.5">
                        Approved on{' '}
                        {new Date(approvedAt).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                    {justApproved && !approvedAt && (
                      <p className="text-sm text-emerald-600 mt-0.5">Just approved</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-800">Ready to approve?</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Click the button to confirm you have reviewed and approved this document.
                    </p>
                  </div>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="flex-shrink-0 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                  >
                    {approveMutation.isPending ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    Approved by Client
                  </button>
                </div>
              )}

              {/* Document card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Doc header */}
                <div className="px-8 pt-10 pb-6 border-b border-slate-100">
                  <h1 className="text-3xl font-bold text-slate-900 leading-tight">
                    {data.title || 'Untitled'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-2">
                    Last updated{' '}
                    {new Date(data.updatedAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Doc body */}
                <div
                  className="px-8 py-8 prose prose-slate max-w-none shared-doc-content"
                  dangerouslySetInnerHTML={{ __html: data.content || '<p><em>This page has no content yet.</em></p>' }}
                />
              </div>
            </>
          ) : null}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-6 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
          <div className="h-5 w-5 rounded-md bg-slate-900 flex items-center justify-center">
            <div className="h-3 w-3 rounded-sm bg-gradient-to-br from-indigo-400 to-cyan-300" />
          </div>
          <span>
            <span className="font-semibold text-slate-600">BuilderOS</span>
            {' '}· powered by Baaz Homes · shared document view
          </span>
        </div>
      </footer>

      {/* Shared doc styles */}
      <style>{`
        .shared-doc-content p { margin: 0.25rem 0; line-height: 1.7; }
        .shared-doc-content h1 { font-size: 2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .shared-doc-content h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
        .shared-doc-content h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.35rem; }
        .shared-doc-content strong { font-weight: 700; }
        .shared-doc-content em { font-style: italic; }
        .shared-doc-content u { text-decoration: underline; }
        .shared-doc-content s { text-decoration: line-through; }
        .shared-doc-content mark { background-color: #fef08a; border-radius: 2px; padding: 0 2px; }
        .shared-doc-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
        .shared-doc-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
        .shared-doc-content li { margin: 0.15rem 0; }
        .shared-doc-content blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; margin: 0.5rem 0; }
        .shared-doc-content code { background: #f1f5f9; border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.875em; }
        .shared-doc-content pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 0.5rem 0; }
        .shared-doc-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .shared-doc-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .shared-doc-content ul[data-type="taskList"] li label { flex-shrink: 0; padding-top: 0.2rem; }
        .shared-doc-content ul[data-type="taskList"] li label input { width: 1rem; height: 1rem; accent-color: #4f46e5; }
        .shared-doc-content ul[data-type="taskList"] li[data-checked="true"] div { text-decoration: line-through; opacity: 0.5; }
      `}</style>
    </div>
  );
}

export default SharedDocPage;
