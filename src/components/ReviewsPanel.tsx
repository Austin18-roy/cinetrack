import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, increment, query, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Flag } from 'lucide-react';
import { ReportModal } from './ReportModal';

interface Review {
  id: string;
  userId: string;
  username: string;
  rating: number;
  text: string;
  helpful: number;
  unhelpful: number;
  createdAt: any;
  type: "audience" | "critic";
}

export function ReviewsPanel({ contentId }: { contentId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sort, setSort] = useState("newest");
  const [userRole, setUserRole] = useState<"audience" | "critic">("audience");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportingReview, setReportingReview] = useState<Review | null>(null);

  useEffect(() => {
    if (!contentId) return;
    
    // Convert contentId to a string safe for firestore paths just in case it is a number
    const safeContentId = String(contentId);
    const revRef = collection(db, "reviews", safeContentId, "reviews");
    const q = query(revRef, orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `/reviews/${safeContentId}/reviews`);
    });

    return () => unsub();
  }, [contentId]);

  const submitReview = async () => {
    if (rating === 0) return alert('Please provide a rating');
    if (!text.trim()) return alert('Please enter a review');
    if (!auth.currentUser) return alert('Please sign in to review');

    setIsSubmitting(true);
    try {
      const safeContentId = String(contentId);
      const newReview = {
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Anonymous',
        rating,
        text,
        helpful: 0,
        unhelpful: 0,
        type: userRole,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "reviews", safeContentId, "reviews"), newReview);
      
      setRating(0);
      setText("");
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `/reviews/${contentId}/reviews`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markHelpful = async (reviewId: string) => {
    if (!auth.currentUser) return alert('Please sign in to vote');
    try {
      const safeContentId = String(contentId);
      const ref = doc(db, "reviews", safeContentId, "reviews", reviewId);
      await updateDoc(ref, {
        helpful: increment(1)
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `/reviews/${contentId}/reviews/${reviewId}`);
    }
  };

  const markUnhelpful = async (reviewId: string) => {
    if (!auth.currentUser) return alert('Please sign in to vote');
    try {
      const safeContentId = String(contentId);
      const ref = doc(db, "reviews", safeContentId, "reviews", reviewId);
      await updateDoc(ref, {
        unhelpful: increment(1)
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `/reviews/${contentId}/reviews/${reviewId}`);
    }
  };

  const sortReviews = (reviewsToSort: Review[]) => {
    if (sort === "newest") {
      return [...reviewsToSort].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }
    if (sort === "highest") {
      return [...reviewsToSort].sort((a, b) => b.rating - a.rating);
    }
    if (sort === "lowest") {
      return [...reviewsToSort].sort((a, b) => a.rating - b.rating);
    }
    if (sort === "helpful") {
      return [...reviewsToSort].sort((a, b) => b.helpful - a.helpful);
    }
    return reviewsToSort;
  };

  const getScores = (reviews: Review[]) => {
    const audience = reviews.filter(r => r.type === "audience");
    const critic = reviews.filter(r => r.type === "critic");
  
    const avg = (arr: Review[]) =>
      arr.length
        ? arr.reduce((a, b) => a + b.rating, 0) / arr.length
        : 0;
  
    return {
      audienceScore: avg(audience).toFixed(1),
      criticScore: avg(critic).toFixed(1),
      audienceCount: audience.length,
      criticCount: critic.length
    };
  };

  const sortedReviews = sortReviews(reviews);
  const scores = getScores(reviews);

  return (
    <div className="space-y-6">
      {/* SCORES BARS */}
      <div className="flex gap-4 mb-6 text-sm font-bold uppercase tracking-widest">
        <div className="bg-[#111] border border-white/10 rounded-lg p-3 flex-1 text-center text-zinc-400">
          🎬 Critics: {scores.criticScore} <span className="text-[10px] ml-1">({scores.criticCount})</span>
        </div>
        <div className="bg-[#111] border border-white/10 rounded-lg p-3 flex-1 text-center text-zinc-400">
          👥 Audience: {scores.audienceScore} <span className="text-[10px] ml-1">({scores.audienceCount})</span>
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-[#111] border border-white/10 p-6 rounded-2xl space-y-4">
        <h4 className="text-xl font-bold">Write a Review</h4>
        <div className="flex gap-2 text-2xl">
          {[...Array(10)].map((_, i) => (
            <span
              key={i}
              onClick={() => setRating(i + 1)}
              style={{
                color: i < rating ? "gold" : "gray",
                cursor: "pointer"
              }}
            >
              ★
            </span>
          ))}
        </div>
        
        <textarea
          placeholder="Write your review here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-white/30 text-white min-h-[100px] resize-y"
        />

        <div className="flex justify-between items-center">
           <select 
             value={userRole} 
             onChange={(e) => setUserRole(e.target.value as any)}
             className="bg-[#1a1a1a] border border-white/10 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
           >
             <option value="audience">I'm an Audience</option>
             <option value="critic">I'm a Critic</option>
           </select>

           <button 
             onClick={submitReview}
             disabled={isSubmitting}
             className="bg-white text-black font-bold uppercase tracking-widest text-xs px-6 py-2 rounded-full hover:bg-zinc-200 transition disabled:opacity-50"
           >
             {isSubmitting ? 'Posting...' : 'Submit'}
           </button>
        </div>
      </div>

      {/* REVIEWS LIST */}
      <div>
        <div className="flex justify-between items-center mb-4">
           <h4 className="text-lg font-bold">Community Thoughts</h4>
           <select 
             onChange={(e) => setSort(e.target.value)}
             className="bg-[#111] border border-white/10 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
           >
             <option value="newest">Most Recent</option>
             <option value="highest">Highest Rated</option>
             <option value="lowest">Lowest Rated</option>
             <option value="helpful">Most Helpful</option>
           </select>
        </div>

        <div className="space-y-4">
          {sortedReviews.length === 0 && <p className="text-zinc-500 text-sm">No reviews yet. Be the first!</p>}
          {sortedReviews.map(r => (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               key={r.id} 
               className="bg-[#111] border border-white/10 hover:border-white/20 hover:bg-[#1a1a1a] transition-colors p-4 md:p-5 rounded-2xl"
            >
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h4 className="font-bold text-sm text-zinc-100">{r.username}</h4>
                    <span className="text-xs text-zinc-500 uppercase font-black tracking-widest mt-1 inline-block">{r.type}</span>
                 </div>
                 <div className="flex items-center gap-1 font-bold text-sm">
                    <span className="text-yellow-400">★</span> {r.rating}/10
                 </div>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4 mt-2 whitespace-pre-wrap">{r.text}</p>
              
              <div className="flex justify-between items-center text-xs text-zinc-500">
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => markHelpful(r.id)}
                      className="hover:text-white flex items-center transition bg-white/5 px-3 py-1.5 rounded-full"
                    >
                      👍 Mark as Helpful ({r.helpful || 0})
                    </button>
                    <button 
                      onClick={() => markUnhelpful(r.id)}
                      className="hover:text-white flex items-center transition bg-white/5 px-3 py-1.5 rounded-full"
                    >
                      👎 Dislike ({r.unhelpful || 0})
                    </button>
                    <button 
                      onClick={() => setReportingReview(r)}
                      className="hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 transition bg-white/5 px-3 py-1.5 rounded-full text-zinc-400 cursor-pointer"
                      title="Report inappropriate content"
                    >
                      <Flag className="w-3.5 h-3.5 text-zinc-500 hover:text-red-400" />
                      Report
                    </button>
                 </div>
                 <small>{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</small>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {reportingReview && (
        <ReportModal
          isOpen={!!reportingReview}
          onClose={() => setReportingReview(null)}
          reviewId={reportingReview.id}
          contentId={contentId}
          reviewText={reportingReview.text}
          reportedUserId={reportingReview.userId}
          reportedUsername={reportingReview.username}
        />
      )}
    </div>
  );
}
