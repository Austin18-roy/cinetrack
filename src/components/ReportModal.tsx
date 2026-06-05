import React, { useState } from 'react';
import { X, Flag, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  contentId: string;
  reviewText: string;
  reportedUserId: string;
  reportedUsername: string;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or Advertising', desc: 'Commercial posts, links, or repetitive text' },
  { id: 'harassment', label: 'Harassment or Abuse', desc: 'Hate speech, personal attacks, or threats' },
  { id: 'inappropriate', label: 'Inappropriate Content', desc: 'Profanity, explicit descriptions, or vulgar text' },
  { id: 'spoiler', label: 'Unmarked Spoiler', desc: 'Reveals major twists without warning' },
  { id: 'other', label: 'Other Guidelines Violation', desc: 'Substantial off-topic content or fake text' },
];

export function ReportModal({
  isOpen,
  onClose,
  reviewId,
  contentId,
  reviewText,
  reportedUserId,
  reportedUsername,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('You must be signed in to report content');
      return;
    }
    if (!selectedReason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    try {
      const reportData = {
        reviewId: String(reviewId),
        contentId: String(contentId || 'unknown'),
        reportedUserId: String(reportedUserId),
        reportedUsername: String(reportedUsername || 'Anonymous'),
        flaggedBy: auth.currentUser.uid,
        reason: selectedReason,
        text: details.trim(),
        reviewText: String(reviewText),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'reports'), reportData);
      setIsDone(true);
      toast.success('Report submitted successfully. Thank you!');
    } catch (err) {
      console.error('Failed to submit report:', err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'reports');
      } catch (fErr: any) {
        toast.error('Database validation error submitting report');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[8000] flex justify-center items-center p-4" onClick={onClose} id="report-modal-overlay">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity" />
      
      <div 
        className="bg-[#141414] rounded-2xl w-full max-w-md relative z-10 shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        id="report-modal-container"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between" id="report-modal-header">
          <div className="flex items-center gap-2 text-red-500">
            <Flag className="w-5 h-5" id="report-modal-icon-flag" />
            <span className="font-bold text-sm uppercase tracking-wider" id="report-modal-header-title">Report Review</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
            id="report-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm" id="report-modal-body">
          {isDone ? (
            <div className="text-center py-8 space-y-4" id="report-modal-done-panel">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto" id="report-icon-success">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5" id="report-success-msg-container">
                <h3 className="text-lg font-bold text-white">We're reviewing this</h3>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  Thank you for keeping our community movie-reviews space safe and healthy! Our moderation framework has registered your flag.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-widest text-[10px] sm:text-xs py-2 px-6 rounded-full transition cursor-pointer"
                id="report-success-btn"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" id="report-modal-form">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1" id="report-modal-preview">
                <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Review by {reportedUsername}:</span>
                <p className="text-zinc-300 text-xs italic line-clamp-2 leading-relaxed">"{reviewText}"</p>
              </div>

              <div className="space-y-2" id="report-reasons-container">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400 block pb-0.5">Please select a reason:</label>
                <div className="space-y-2" id="report-reasons-options">
                  {REPORT_REASONS.map((reason) => {
                    const isSelected = selectedReason === reason.id;
                    return (
                      <button
                        type="button"
                        key={reason.id}
                        onClick={() => setSelectedReason(reason.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-start gap-3 cursor-pointer ${
                          isSelected 
                            ? 'bg-red-500/10 border-red-500/40 text-white shadow-lg' 
                            : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:border-white/10 hover:bg-[#222]'
                        }`}
                        id={`report-reason-opt-${reason.id}`}
                      >
                        <div 
                          className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition ${
                            isSelected ? 'border-red-500 text-red-500' : 'border-zinc-500'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-red-500" />}
                        </div>
                        <div className="space-y-0.5" id={`report-reason-details-${reason.id}`}>
                          <p className={`font-bold text-xs ${isSelected ? 'text-red-400' : 'text-zinc-200'}`}>{reason.label}</p>
                          <p className="text-[10px] text-zinc-400 leading-normal">{reason.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2" id="report-details-textarea">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400 block" htmlFor="additional-comments">Additional Details (Optional):</label>
                <textarea
                  id="additional-comments"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Tell us more about why you flagged this review..."
                  rows={2}
                  maxLength={1000}
                  className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-red-500/50 text-xs placeholder:text-zinc-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end text-xs font-bold uppercase tracking-widest" id="report-modal-footer">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white py-2.5 px-4 rounded-xl transition cursor-pointer"
                  id="report-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedReason}
                  className="bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-red-900/20"
                  id="report-submit-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" id="report-submit-spinning" />
                      Reporting...
                    </>
                  ) : (
                    <>
                      <Flag className="w-3.5 h-3.5" id="report-submit-flag-btn" />
                      Submit Flag
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
