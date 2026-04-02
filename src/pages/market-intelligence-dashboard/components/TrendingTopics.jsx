import { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const mockTopics = [
  { word: 'exclusive', count: 18 }, { word: 'discount', count: 15 }, { word: 'limited', count: 14 },
  { word: 'launch', count: 12 }, { word: 'personalized', count: 11 }, { word: 'automation', count: 10 },
  { word: 'engagement', count: 9 }, { word: 'deliverability', count: 8 }, { word: 'segmentation', count: 7 },
  { word: 'conversion', count: 6 }, { word: 'retention', count: 5 }, { word: 'nurture', count: 4 },
];

const TrendingTopics = ({ days = 7 }) => {
  const [topics, setTopics] = useState(mockTopics);
  const [loading, setLoading] = useState(false);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('trending_topics')
        ?.select('word, count')
        ?.order('count', { ascending: false })
        ?.limit(15);

      if (!error && data?.length > 0) {
        setTopics(data);
      }
    } catch (err) {
      // Use mock data as fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [days]);

  const max = Math.max(...topics?.map(t => t?.count) || [1]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Trending Topics</h3>
        {loading && <Icon name="Loader" size={14} className="animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2">
        {topics?.map((topic, i) => {
          const size = 0.7 + (topic?.count / max) * 0.8;
          const opacity = 0.5 + (topic?.count / max) * 0.5;
          return (
            <span
              key={topic?.word}
              className="px-2.5 py-1 bg-primary/10 text-primary rounded-full cursor-default hover:bg-primary/20 transition-colors"
              style={{ fontSize: `${size}rem`, opacity }}
              title={`${topic?.count} mentions`}
            >
              {topic?.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingTopics;
