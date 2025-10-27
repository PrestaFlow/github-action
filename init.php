<?php

require_once __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\SingleCommandApplication;
use Symfony\Component\Console\Style\SymfonyStyle;

const PRESTAFLOW_API_URL = 'https://api.prestaflow.io';

(new SingleCommandApplication())
    ->setName('PrestaFlow') // Optional
    ->setVersion('1.0.0') // Optional
    ->addArgument('prestaflow_account_id', InputArgument::OPTIONAL, 'PrestaFlow Account ID')
    ->setCode(function (InputInterface $input, OutputInterface $output) {

        $buffer = new BufferedOutput($output->getVerbosity());
        $io = new SymfonyStyle($input, $buffer);
        $client = new \GuzzleHttp\Client([
            'base_uri' => PRESTAFLOW_API_URL
        ]);

        // Call
        try {
            $response = $client->post('/api/github-action', [
                'multipart' => [
                    [
                        'name'     => 'account_id',
                        'contents' => $input->getArgument('prestaflow_account_id'),
                    ],
                    [
                        'name'     => 'key',
                        'contents' => getenv('PRESTAFLOW_SECRET_KEY'),
                    ]
                ]
            ]);

            $stdResponse = json_decode($response->getBody()->getContents(), true);
        } catch (\Throwable $th) {
            $io->writeln($th->getMessage());
            return Command::FAILURE;
        }

        // Format response
        $io->title('PrestaFlow Results');
        $isValid = true;

        foreach ($stdResponse as $category => $reports) {
            switch ($category) {
                default:
                    $count = 0;
                    $table = new Table($buffer);
                    $table->setHeaders(['File', 'Error']);
                    if (is_array($reports)) {
                        foreach ($reports as $key => $item) {
                            foreach ($item as $rule) {
                                if (is_array($rule)) {
                                    foreach ($rule as $errors) {
                                        foreach ($errors['content'] as $error) {
                                            $table->addRows([
                                                [$error['file'] . ':' . $error['line'], $error['message']],
                                            ]);
                                            $count++;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if ($count >= 1) {
                        $io->writeln('<details>');
                        $io->writeln("<summary>$category</summary>");
                        $io->writeln("<pre>");
                        $table->setStyle('box');
                        $table->render();
                        $io->writeln('</details>');
                    }
                    break;
            }
        }

        // TODO: use symfony/filesystem
        file_put_contents('result_prestaflow.txt', $buffer->fetch());

        if (true === $isValid) {
            return Command::SUCCESS;
        } else {
            return Command::FAILURE;
        }
    })
    ->run();
