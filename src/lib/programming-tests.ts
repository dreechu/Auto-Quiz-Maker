export const PROGRAMMING_TESTS: Record<
  string,
  { sample: { stdin: string; expected: string }; hidden: { stdin: string; expected: string } }
> = {
  "sum-pairs": {
    sample: {
      stdin: "2 3\n-7 11\n100 250\n",
      expected: "5\n4\n350\n",
    },
    hidden: {
      stdin: "0 0\n-100000 99999\n214748364 13579\n",
      expected: "0\n-1\n214761943\n",
    },
  },
  "count-vowels": {
    sample: {
      stdin: "Recall\nprogramming\nJava and C\n",
      expected: "2\n3\n3\n",
    },
    hidden: {
      stdin: "AEIOU\nrhythm\nOpenAI\n",
      expected: "5\n0\n4\n",
    },
  },
  "prime-check": {
    sample: {
      stdin: "7\n12\n1\n2\n",
      expected: "YES\nNO\nNO\nYES\n",
    },
    hidden: {
      stdin: "0\n97\n1000000000\n999999937\n",
      expected: "NO\nYES\nNO\nYES\n",
    },
  },
  fibonacci: {
    sample: {
      stdin: "0\n1\n10\n",
      expected: "0\n1\n55\n",
    },
    hidden: {
      stdin: "2\n20\n50\n92\n",
      expected: "1\n6765\n12586269025\n7540113804746346429\n",
    },
  },
  "animal-inheritance": {
    sample: {
      stdin: "4\nDog\nCat\nCat\nDog\n",
      expected: "Dog: Woof!\nCat: Meow!\nCat: Meow!\nDog: Woof!\n",
    },
    hidden: {
      stdin: "3\nCat\nDog\nCat\n",
      expected: "Cat: Meow!\nDog: Woof!\nCat: Meow!\n",
    },
  },
  "binary-search": {
    sample: {
      stdin: "6 7\n1 3 5 7 9 11\n5 4\n2 4 6 8 10\n",
      expected: "3\n1\n",
    },
    hidden: {
      stdin: "1 9\n9\n5 2\n1 3 5 7 9\n4 8\n2 4 6 8\n",
      expected: "0\n-1\n3\n",
    },
  },
  "stack-operations": {
    sample: {
      stdin: "7\npush 4\npush 8\npop\npop\npop\npush -2\npop\n",
      expected: "8\n4\nEMPTY\n-2\n",
    },
    hidden: {
      stdin: "9\npop\npush 0\npush -5\npop\npush 12\npop\npop\npush 99\npop\n",
      expected: "EMPTY\n-5\n12\n0\n99\n",
    },
  },
};
