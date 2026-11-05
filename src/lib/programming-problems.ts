export type PracticeLanguage = "java" | "c";
export type ProgrammingCategory = "Fundamentals" | "OOP" | "DSA";

export type ProgrammingProblem = {
  id: string;
  title: string;
  topic: string;
  category: ProgrammingCategory;
  difficulty: "Easy" | "Medium";
  supportedLanguages: PracticeLanguage[];
  description: string;
  input: string;
  output: string;
  sampleInput: string;
  sampleOutput: string;
  starter: Partial<Record<PracticeLanguage, string>>;
};

export const PROGRAMMING_PROBLEMS: ProgrammingProblem[] = [
  {
    id: "sum-pairs",
    title: "Sum Each Pair",
    topic: "Input and output",
    category: "Fundamentals",
    difficulty: "Easy",
    supportedLanguages: ["java", "c"],
    description:
      "Read integer pairs until the end of input. Print the sum of each pair on its own line. Your program should handle negative values and zero.",
    input: "Each line contains two integers a and b. Input ends at EOF.",
    output: "Print a + b for each input line.",
    sampleInput: "2 3\n-7 11\n100 250",
    sampleOutput: "5\n4\n350",
    starter: {
      c: `#include <stdio.h>

int main(void) {
    int a, b;
    while (scanf("%d %d", &a, &b) == 2) {
        printf("%d\\n", a + b);
    }
    return 0;
}`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        while (input.hasNextInt()) {
            int a = input.nextInt();
            if (!input.hasNextInt()) break;
            int b = input.nextInt();
            System.out.println(a + b);
        }
    }
}`,
    },
  },
  {
    id: "count-vowels",
    title: "Count the Vowels",
    topic: "Strings",
    category: "Fundamentals",
    difficulty: "Easy",
    supportedLanguages: ["java", "c"],
    description:
      "For every line of text, count how many English vowels it contains. Treat uppercase and lowercase letters the same. Print one count per line.",
    input: "One line of text per case, read until EOF.",
    output: "The number of a, e, i, o, and u characters on each line.",
    sampleInput: "Recall\nprogramming\nJava and C",
    sampleOutput: "2\n3\n3",
    starter: {
      c: `#include <stdio.h>
#include <ctype.h>

int main(void) {
    char line[4096];
    while (fgets(line, sizeof(line), stdin)) {
        int count = 0;
        for (int i = 0; line[i] != '\\0'; i++) {
            char ch = (char)tolower((unsigned char)line[i]);
            if (ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u') {
                count++;
            }
        }
        printf("%d\\n", count);
    }
    return 0;
}`,
      java: `import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = input.readLine()) != null) {
            int count = 0;
            for (char ch : line.toLowerCase().toCharArray()) {
                if ("aeiou".indexOf(ch) >= 0) count++;
            }
            System.out.println(count);
        }
    }
}`,
    },
  },
  {
    id: "prime-check",
    title: "Prime Number Check",
    topic: "Loops and conditions",
    category: "Fundamentals",
    difficulty: "Medium",
    supportedLanguages: ["java", "c"],
    description:
      "Determine whether each input integer is prime. A prime number is greater than 1 and has no positive divisors other than 1 and itself.",
    input: "One integer n per line, read until EOF. Values are between 0 and 1,000,000,000.",
    output: "Print YES if n is prime; otherwise print NO.",
    sampleInput: "7\n12\n1\n2",
    sampleOutput: "YES\nNO\nNO\nYES",
    starter: {
      c: `#include <stdio.h>

int main(void) {
    long long n;
    while (scanf("%lld", &n) == 1) {
        int prime = n > 1;
        for (long long d = 2; prime && d * d <= n; d++) {
            if (n % d == 0) prime = 0;
        }
        puts(prime ? "YES" : "NO");
    }
    return 0;
}`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        while (input.hasNextLong()) {
            long n = input.nextLong();
            boolean prime = n > 1;
            for (long d = 2; prime && d * d <= n; d++) {
                if (n % d == 0) prime = false;
            }
            System.out.println(prime ? "YES" : "NO");
        }
    }
}`,
    },
  },
  {
    id: "fibonacci",
    title: "Fibonacci Numbers",
    topic: "Sequences",
    category: "Fundamentals",
    difficulty: "Medium",
    supportedLanguages: ["java", "c"],
    description:
      "For each n, print the nth Fibonacci number. The sequence starts F(0) = 0, F(1) = 1, and F(n) = F(n - 1) + F(n - 2).",
    input: "One integer n per line, read until EOF. Values are between 0 and 92.",
    output: "Print F(n) on its own line for each input.",
    sampleInput: "0\n1\n10",
    sampleOutput: "0\n1\n55",
    starter: {
      c: `#include <stdio.h>

int main(void) {
    int n;
    while (scanf("%d", &n) == 1) {
        long long previous = 0, current = 1;
        for (int i = 0; i < n; i++) {
            if (i + 1 == n) break;
            long long next = previous + current;
            previous = current;
            current = next;
        }
        printf("%lld\\n", previous);
    }
    return 0;
}`,
      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        while (input.hasNextInt()) {
            int n = input.nextInt();
            long previous = 0, current = 1;
            for (int i = 0; i < n; i++) {
                if (i + 1 == n) break;
                long next = previous + current;
                previous = current;
                current = next;
            }
            System.out.println(previous);
        }
    }
}`,
    },
  },
  {
    id: "animal-inheritance",
    title: "Animal Inheritance",
    topic: "Inheritance and method overriding",
    category: "OOP",
    difficulty: "Easy",
    supportedLanguages: ["java"],
    description:
      "Practice Java inheritance and runtime polymorphism. Create a base Animal class with a speak() method, then make Dog and Cat subclasses that override it. Read each animal name, create the matching subclass, and call speak() through an Animal reference.",
    input: "The first line contains an integer n. The next n lines contain either Dog or Cat.",
    output: "For each input animal, print `Dog: Woof!` or `Cat: Meow!`.",
    sampleInput: "4\nDog\nCat\nCat\nDog",
    sampleOutput: "Dog: Woof!\nCat: Meow!\nCat: Meow!\nDog: Woof!",
    starter: {
      java: `import java.util.Scanner;

abstract class Animal {
    abstract String speak();
}

class Dog extends Animal {
    @Override
    String speak() {
  // TODO: Return this dog's sound.
  return "";
    }
}

class Cat extends Animal {
    @Override
    String speak() {
  // TODO: Return this cat's sound.
  return "";
    }
}

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int n = input.nextInt();
        for (int i = 0; i < n; i++) {
            String kind = input.next();
            Animal animal = kind.equals("Dog") ? new Dog() : new Cat();
            System.out.println(kind + ": " + animal.speak());
        }
    }
}`,
    },
  },
  {
    id: "binary-search",
    title: "Binary Search",
    topic: "Searching and arrays",
    category: "DSA",
    difficulty: "Medium",
    supportedLanguages: ["c"],
    description:
      "Implement binary search in C to find a target in a sorted integer array. Return the target's zero-based index, or -1 if it is not present. Aim for O(log n) time.",
    input: "Each case starts with n and target, followed by n sorted integers (1 <= n <= 100,000). Cases continue until EOF.",
    output: "Print the zero-based index of target, or -1, for each case.",
    sampleInput: "6 7\n1 3 5 7 9 11\n5 4\n2 4 6 8 10",
    sampleOutput: "3\n1",
    starter: {
      c: `#include <stdio.h>

int binary_search(const int values[], int n, int target) {
    /* TODO: implement binary search and return the target index, or -1. */
    (void)values;
    (void)n;
    (void)target;
    return -1;
}

int main(void) {
    int n, target;
    while (scanf("%d %d", &n, &target) == 2) {
        int values[100000];
        for (int i = 0; i < n; i++) scanf("%d", &values[i]);
        printf("%d\\n", binary_search(values, n, target));
    }
    return 0;
}`,
    },
  },
  {
    id: "stack-operations",
    title: "Build a Stack",
    topic: "Stacks",
    category: "DSA",
    difficulty: "Medium",
    supportedLanguages: ["c"],
    description:
      "Implement a stack in C using an array. Process push and pop operations in order. A pop from an empty stack should print EMPTY. The stack will never exceed 100,000 values.",
    input: "The first line contains q (1 <= q <= 100,000). Each of the next q lines is `push x` or `pop`.",
    output: "For each pop, print the removed value, or EMPTY if the stack is empty.",
    sampleInput: "7\npush 4\npush 8\npop\npop\npop\npush -2\npop",
    sampleOutput: "8\n4\nEMPTY\n-2",
    starter: {
      c: `#include <stdio.h>
#include <string.h>

int main(void) {
    int q;
    if (scanf("%d", &q) != 1) return 0;

    int stack[100000];
    int size = 0;
    char operation[8];

    for (int i = 0; i < q; i++) {
        scanf("%7s", operation);
        if (strcmp(operation, "push") == 0) {
            int value;
            scanf("%d", &value);
            /* TODO: push value onto the stack. */
        } else {
            /* TODO: print the popped value, or EMPTY when the stack is empty. */
            puts("EMPTY");
        }
    }
    return 0;
}`,
    },
  },
];

export function createStarterFiles(problemId: string, language: PracticeLanguage) {
  const problem = PROGRAMMING_PROBLEMS.find((item) => item.id === problemId);
  const content = problem?.starter[language];
  if (!problem || !content || !problem.supportedLanguages.includes(language)) return [];
  return [{
    name: language === "java" ? "Main.java" : "main.c",
    content,
  }];
}
