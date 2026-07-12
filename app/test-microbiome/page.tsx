'use client';
import MicrobiomePanel from '@/components/MicrobiomePanel';
import InlineChat from '@/components/InlineChat';
export default function TestMicrobiome() {
  return (
    <div>
      <InlineChat
        sample="kiki"
        samplePath="/kiki"
        starterQuestions={['How does my dog\'s microbiome compare to a healthy reference?']}
      />
      <MicrobiomePanel samplePath="/kiki" />
    </div>
  );
}
